"""Wrapper pro Claude Code CLI headless (`claude -p`). Só é chamado na
Camada 3 do dedup (spec seção 6) — quando a busca exata (Camada 2) não
achou nada, ou seja, só pra erro genuinamente novo/ambíguo. Reincidência
exata nunca gasta chamada de IA.

Responsabilidade única do Claude aqui: classificar + decidir se é o
mesmo problema de algo já no shortlist. Nunca escolhe/executa ação
(catálogo fechado, seção 7 do spec) — isso é responsabilidade de uma
etapa posterior, separada, só depois de aprovação humana.

Política de conta e timeout (decisão 2026-09-15, pós-incidente de estouro
de sessão — revisada no mesmo dia após 2 tentativas de conta única
esbarrarem em contas que também têm uso interativo humano): a automação
usa 2 contas em failover (primária + ~/.claude-account-b), aceitando o
compartilhamento com uso humano, mas com dois limites que reduzem
drasticamente o pior caso: teto de 5 classificações/execuções por rodada
(coletor.py/aplicador.py, vale pro total das 2 contas somadas) e timeout
de TIMEOUT_MAXIMO_S (5min) por chamada — se estourar ou se as 2 contas
baterem rate-limit, a tarefa é escalada pra revisão humana via
TarefaEscalada em vez de ficar presa ou continuar tentando sozinha.
"""
import fcntl
import json
import os
import re
import subprocess
from datetime import datetime, timezone

ESCALONAMENTOS_LOG = os.path.expanduser("~/itp-stack/catalogo-erros-escalonamentos.jsonl")
METRICA_ESCALONAMENTOS_PATH = os.path.expanduser(
    "~/itp-stack/textfile-metrics/catalogo-erros-escalonamentos.prom"
)


def registrar_escalonamento(origem: str, contexto: str, motivo: str, diagnostico: str) -> None:
    """Grava um registro estruturado (jsonl) de toda vez que uma tarefa do
    Claude CLI e' escalada pra revisao humana (timeout ou rate-limit) --
    complementar ao log de texto corrido do coletor/aplicador, pra dar pra
    filtrar/consultar depois e alimentar o alerta do Grafana (métrica
    textfile abaixo). Compartilhado entre coletor.py e aplicador.py."""
    registro = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "origem": origem,  # "coletor" ou "aplicador"
        "contexto": contexto,  # mensagem normalizada ou CodErro
        "motivo": motivo,
        "diagnostico": diagnostico,
    }
    try:
        os.makedirs(os.path.dirname(ESCALONAMENTOS_LOG), exist_ok=True)
        with open(ESCALONAMENTOS_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(registro, ensure_ascii=False) + "\n")
    except OSError:
        pass

    try:
        total = sum(1 for _ in open(ESCALONAMENTOS_LOG, encoding="utf-8"))
        os.makedirs(os.path.dirname(METRICA_ESCALONAMENTOS_PATH), exist_ok=True)
        tmp = METRICA_ESCALONAMENTOS_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(
                "# HELP catalogo_erros_escalonamentos_total Total acumulado de tarefas "
                "do catalogo de erros escaladas pra revisao humana (timeout ou rate-limit).\n"
                "# TYPE catalogo_erros_escalonamentos_total counter\n"
                f"catalogo_erros_escalonamentos_total {total}\n"
            )
        os.replace(tmp, METRICA_ESCALONAMENTOS_PATH)  # write atômico (mesmo padrão do tarefas_runner.py)
    except OSError:
        pass

# Diretório de trabalho pro Claude Code CLI — precisa ser a raiz do repo,
# não a subpasta catalogo-erros/. Achado em teste real (2026-09-10): rodando
# de dentro de catalogo-erros/, o Claude corretamente se recusou a mexer em
# apps/frontend/ ou rodar deploy.sh por não ter escopo — teve que reportar
# "precisa de atenção humana" em vez de aplicar a correção real.
DIRETORIO_REPO = os.path.expanduser("~/erp_itp")

CATEGORIAS_VALIDAS = {"banco", "código", "infra", "security", "integracao", "usuario", "terceiros"}
CRITICIDADES_VALIDAS = {"baixa", "media", "alta", "critica"}
IA_PODE_RESOLVER_VALIDOS = {"seguro", "sem risco", "mediano", "alto risco"}
CAMADAS_VALIDAS = {"log_app", "schema_banco", "infra_vm", "integracao_ext"}

PROMPT_TEMPLATE = """Você está classificando um erro capturado nos logs da VM \
vm-itp-prod, pro catálogo automático de erros descrito em CATALOGO-ERROS.md \
do repositório erp_itp. Responda ESTRITAMENTE com um objeto JSON válido, \
sem markdown, sem texto antes ou depois.

## Contexto do erro

Container/origem: {container}
Aplicação sugerida (você pode confirmar ou trocar por "BD" se for erro do \
motor do banco em si, não de uma app específica; "SITE" já vem pré-detectado \
quando a mensagem tem o prefixo [site-institucional], mantenha como está \
nesse caso): {aplicacao_sugerida}
Mensagem normalizada (timestamps/IDs/UUIDs já removidos): {mensagem_normalizada}
Mensagem bruta de exemplo: {mensagem_bruta}

## Itens já catalogados dessa mesma aplicação (pra você checar se é o mesmo problema)

{shortlist_formatada}

## Rubrica de Criticidade — use impacto real, não a categoria do erro

- critica: impede função central do sistema pra todos os usuários, ou há \
dado sendo perdido/corrompido em produção agora.
- alta: afeta função importante ou um subconjunto relevante de usuários/dados; \
tem contorno manual, mas doloroso.
- media: degrada experiência ou gera retrabalho, sem bloquear nada essencial.
- baixa: cosmético, ruído esperado, ou não é bug de verdade (exploração \
manual, log de acesso normal).

## Rubrica de Confiança — ancore na qualidade da evidência, não numa sensação

- 9-10: causa raiz confirmada por evidência direta e inequívoca (ex: comparou \
schema real com a entidade/código, bate exatamente com a mensagem de erro).
- 7-8: causa muito provável, evidência forte mas não 100% confirmada/testada.
- 4-6: hipótese plausível, evidência indireta ou parcial — pode haver outra explicação.
- 0-3: chute educado — faltou informação suficiente pra investigar a fundo.

O campo "diagnostico" deve justificar explicitamente qual evidência sustenta \
a nota de confiança escolhida (não é permitido dar uma nota sem dizer o \
porquê) — isso é validado depois por revisão humana.

## Análise de impacto — obrigatória antes de propor a correção

Você está rodando com acesso de leitura ao repositório erp_itp inteiro (não \
só à mensagem de erro). Antes de finalizar "correcao_proposta":

1. Leia o código-fonte real relacionado ao erro — não infira só pela \
mensagem de log. Abra o arquivo/função/entidade que o erro aponta.
2. Procure (grep/busca) outros lugares do código que usam a mesma tabela, \
coluna, função ou padrão afetado. Uma correção que resolve um caso mas \
quebra outro uso já existente é pior do que não corrigir nada.
3. Se não for possível investigar o código de verdade (ex: sem tempo, sem \
acesso a algum arquivo), diga isso explicitamente — e isso deve reduzir a \
nota de confiança (rubrica acima), nunca ficar escondido.

## O que responder (JSON exato, sem campos a mais nem a menos)

{{
  "eh_reincidencia_de": "<CodErro do shortlist acima, se for essencialmente \
o mesmo problema com confiança alta, ou null se for genuinamente novo>",
  "aplicacao": "<ITP, APRXM, DW, BD ou SITE>",
  "categoria": "<uma de: banco, código, infra, security, integracao, usuario, terceiros>",
  "tipo_erro": "<rótulo curto e específico, texto livre, ex: 'Divergência de tipo UUID/varchar em FK'>",
  "descricao_resumida": "<UMA frase curta (máximo ~15 palavras), português \
simples, sem jargão técnico — tipo texto de notificação, não parágrafo. \
Ex: 'Não deu pra salvar a turma do aluno por erro de tipo no banco.' \
NÃO explique a causa técnica aqui, só o que aconteceu na prática — a causa \
detalhada já vai no campo 'diagnostico'.>",
  "criticidade": "<uma de: baixa, media, alta, critica — aplique a rubrica acima>",
  "camada_investigacao": "<uma de: log_app, schema_banco, infra_vm, integracao_ext>",
  "confianca": <número de 0 a 10, aplique a rubrica de confiança acima>,
  "ia_pode_resolver": "<escala de risco da correção proposta, EXATAMENTE \
uma destas strings (com espaço, sem underscore): \"seguro\", \"sem risco\", \
\"mediano\", \"alto risco\" — nessa ordem crescente de risco>",
  "diagnostico": "<análise da causa raiz, incluindo a justificativa explícita \
da nota de confiança escolhida>",
  "impacto_avaliado": "<o que você verificou no código real pra confirmar que \
a correção não quebra outros usos da mesma tabela/coluna/função — ou, se não \
deu pra verificar, diga isso explicitamente>",
  "correcao_proposta": "<correção sugerida, texto, ou 'Nenhuma ação de código — ruído esperado' se não for bug de verdade>"
}}

Lembre-se: na dúvida sobre "eh_reincidencia_de", prefira null (item novo) \
a forçar uma correspondência errada — fundir dois problemas diferentes é \
pior do que duplicar. Se o erro não representa um bug de verdade (ex: \
exploração manual do banco, ruído de redeploy), diga isso claramente no \
diagnóstico e marque ia_pode_resolver como "sem risco" (não há ação/risco \
nenhum a avaliar)."""


def _formatar_shortlist(shortlist: list[dict]) -> str:
    if not shortlist:
        return "(nenhum item catalogado ainda pra essa aplicação)"
    linhas = []
    for item in shortlist:
        linhas.append(
            f"- CodErro={item.get('CodErro')} | Categoria={item.get('Categoria')} "
            f"| TipoErro={item.get('TipoErro')} | Assinatura={item.get('Assinatura')}"
        )
    return "\n".join(linhas)


def _extrair_json(texto: str) -> dict:
    """O Claude as vezes envolve a resposta em ```json ... ``` mesmo quando
    pedimos JSON puro -- as vezes ate com prosa ANTES do bloco (achado real
    2026-09-14: "Unico uso confirmado... \n\n```json\n{...}"), entao um
    regex ancorado em ^ nao pega. Busca o bloco em qualquer posicao; se nao
    achar bloco cercado, cai pro primeiro '{' ate o ultimo '}' do texto."""
    texto = texto.strip()

    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", texto, re.DOTALL)
    if m:
        return json.loads(m.group(1))

    inicio = texto.find("{")
    fim = texto.rfind("}")
    if inicio != -1 and fim != -1 and fim > inicio:
        return json.loads(texto[inicio:fim + 1])

    return json.loads(texto)  # deixa o JSONDecodeError original aparecer


def _mensagem_erro(resultado) -> str:
    """O claude CLI (-p --output-format json) reporta erros de API (ex:
    rate limit) dentro do JSON no STDOUT (campo "result"), nao no stderr --
    achado real em 2026-09-14: coletor ficou ~4h reportando mensagem de erro
    vazia (so olhava stderr) enquanto o motivo real (limite semanal
    estourado, HTTP 429) ficava escondido no stdout."""
    stderr = (resultado.stderr or "").strip()
    try:
        envelope = json.loads(resultado.stdout)
        if envelope.get("is_error"):
            motivo = envelope.get("result") or str(envelope)
            return f"{motivo} (stderr: {stderr[:200]})" if stderr else motivo
    except Exception:
        pass
    return stderr or (resultado.stdout or "")[:500] or "(sem stdout nem stderr)"


def _e_rate_limit(resultado) -> bool:
    """Detecta o 429 real (autoritativo) reportado pelo claude CLI --
    diferente de qualquer estimativa de uso, este e o sinal oficial da API."""
    try:
        envelope = json.loads(resultado.stdout)
        return envelope.get("api_error_status") == 429 or envelope.get("is_error") and "limit" in str(envelope.get("result", "")).lower()
    except Exception:
        return False


TIMEOUT_MAXIMO_S = 300  # teto de 5min por tarefa (decisao 2026-09-15, pos-incidente
# de estouro de sessao) -- nenhuma chamada ao Claude CLI deve rodar mais que isso.
# Ao estourar, a tarefa e' interrompida e escalada pra revisao humana em vez de
# ficar presa ou consumir a janela de sessao indefinidamente.


class TarefaEscalada(Exception):
    """Levantada quando uma chamada ao Claude CLI precisa ser escalada pra um
    humano em vez de repassar um erro generico -- carrega o motivo e um
    diagnostico com tudo que se sabe ate o momento da interrupcao, pra quem
    for revisar entender o que aconteceu sem precisar reproduzir."""

    def __init__(self, motivo: str, diagnostico: str):
        super().__init__(motivo)
        self.motivo = motivo
        self.diagnostico = diagnostico


CLAUDE_CONFIG_DIR_B = os.path.expanduser("~/.claude-account-b")

_THROTTLE_FILE = os.path.expanduser("~/itp-stack/claude-failover-notificado.json")
_THROTTLE_SEGUNDOS = 6 * 3600  # 1 email a cada 6h no maximo, nao a cada rodada (5 em 5 min)


def _deve_notificar_agora() -> bool:
    """Sem isso, cada rodada que bate rate-limit manda um email novo --
    achado real 2026-09-14. So notifica de novo depois de _THROTTLE_SEGUNDOS."""
    import time
    agora = time.time()
    try:
        ultimo = json.load(open(_THROTTLE_FILE, encoding="utf-8")).get("ultimo_epoch", 0)
    except Exception:
        ultimo = 0
    if agora - ultimo < _THROTTLE_SEGUNDOS:
        return False
    try:
        json.dump({"ultimo_epoch": agora}, open(_THROTTLE_FILE, "w", encoding="utf-8"))
    except Exception:
        pass
    return True


def _notificar_troca_de_conta(motivo: str) -> None:
    """Avisa por email (Graph API do relatorio-grafana) quando a conta
    principal do claude CLI bate o limite e o sistema troca pra conta B.
    Falha silenciosamente se o email nao sair. Throttled -- ver acima."""
    if not _deve_notificar_agora():
        return
    try:
        import requests
        env_path = os.path.expanduser("~/itp-stack/relatorio_grafana.env")
        cfg = {}
        with open(env_path, "r", encoding="utf-8") as f:
            for linha in f:
                linha = linha.strip()
                if not linha or linha.startswith("#") or "=" not in linha:
                    continue
                k, v = linha.split("=", 1)
                cfg[k.strip()] = v.strip()
        token_resp = requests.post(
            f"https://login.microsoftonline.com/{cfg['MS_TENANT_ID']}/oauth2/v2.0/token",
            data={
                "client_id": cfg["MS_CLIENT_ID"],
                "client_secret": cfg["MS_CLIENT_SECRET"],
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
            timeout=30,
        )
        token_resp.raise_for_status()
        token = token_resp.json()["access_token"]
        mensagem = {
            "message": {
                "subject": "[Catalogo de Erros] Conta do Claude CLI trocada automaticamente",
                "body": {
                    "contentType": "HTML",
                    "content": f"<p>A conta principal do Claude CLI bateu o limite de uso e o sistema trocou automaticamente para a conta secundaria.</p><p>Motivo: {motivo}</p>",
                },
                "toRecipients": [{"emailAddress": {"address": "monitoramento@institutotiapretinha.org"}}],
            },
            "saveToSentItems": "false",
        }
        requests.post(
            "https://graph.microsoft.com/v1.0/users/projetos@institutotiapretinha.org/sendMail",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=mensagem,
            timeout=30,
        )
    except Exception:
        pass


GLOBAL_LOCK_FILE = os.path.expanduser("~/itp-stack/claude-cli-global.lock")


def _rodar_uma_vez(args: list[str], timeout_s: int, prompt: str, env=None):
    """Roda o claude CLI uma unica vez, com um env opcional (pra apontar
    CLAUDE_CONFIG_DIR pra outra conta). Timeout tratado explicitamente:
    se estourar TIMEOUT_MAXIMO_S, levanta TarefaEscalada documentando tudo
    que deu pra capturar antes do kill.

    Trava global bloqueante (decisao 2026-09-15): nunca roda mais de um
    processo `claude` ao mesmo tempo no servidor inteiro, seja coletor.py,
    aplicador.py ou qualquer script futuro -- 2 chamadas simultaneas nao
    aceleram nada (o teto de 5/rodada e' por execucao, nao por tempo) e so
    aumentam o risco de estourar limite de conta mais rapido. Bloqueante
    (LOCK_EX sem NB) de proposito: a segunda chamada espera a vez em vez
    de falhar."""
    os.makedirs(os.path.dirname(GLOBAL_LOCK_FILE), exist_ok=True)
    with open(GLOBAL_LOCK_FILE, "w") as lock_fd:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        try:
            return subprocess.run(
                args, capture_output=True, text=True, timeout=timeout_s, cwd=DIRETORIO_REPO, env=env,
            )
        except subprocess.TimeoutExpired as exc:
            parcial_out = (exc.stdout or "")[:1000] if isinstance(exc.stdout, str) else ""
            parcial_err = (exc.stderr or "")[:500] if isinstance(exc.stderr, str) else ""
            diagnostico = (
                f"[TIMEOUT {timeout_s}s] A tarefa foi interrompida por exceder o "
                f"tempo maximo permitido e precisa de revisao humana.\n\n"
                f"Prompt enviado (inicio):\n{prompt[:1500]}\n\n"
                f"Stdout parcial capturado antes do kill:\n{parcial_out or '(nenhum)'}\n\n"
                f"Stderr parcial capturado antes do kill:\n{parcial_err or '(nenhum)'}"
            )
            raise TarefaEscalada(
                motivo=f"estourou o tempo maximo de {timeout_s}s", diagnostico=diagnostico,
            ) from exc


def _rodar(args: list[str], timeout_s: int, prompt: str):
    """Roda o claude CLI com failover entre 2 contas dedicadas (decisão
    2026-09-15, revisada): nenhuma das duas é usada por humano em uso
    interativo -- ver checklist. Se a conta primária bater rate-limit,
    tenta a secundária (~/.claude-account-b) e notifica por email
    (throttled). O teto de chamadas por rodada (coletor.py/aplicador.py)
    já limita o total combinado das duas contas -- o failover só evita
    que 1 conta rate-limitada pare a automação toda quando a outra ainda
    tem cota livre.

    Timeout de TIMEOUT_MAXIMO_S por tentativa (cada tentativa é uma
    chamada separada, então no pior caso -- rate-limit seguido de timeout
    na conta B -- uma única classificação pode levar até 2x isso)."""
    timeout_s = min(timeout_s, TIMEOUT_MAXIMO_S)

    resultado = _rodar_uma_vez(args, timeout_s, prompt)
    if resultado.returncode == 0 or not _e_rate_limit(resultado):
        return resultado

    if not os.path.isdir(CLAUDE_CONFIG_DIR_B):
        diagnostico = (
            f"[RATE LIMIT] A conta principal bateu o limite de uso e não há "
            f"conta secundária configurada ({CLAUDE_CONFIG_DIR_B} não existe). "
            f"Detalhe: {_mensagem_erro(resultado)[:500]}"
        )
        raise TarefaEscalada(motivo="rate limit da conta (sem conta B disponível)", diagnostico=diagnostico)

    env_b = {**os.environ, "CLAUDE_CONFIG_DIR": CLAUDE_CONFIG_DIR_B}
    resultado_b = _rodar_uma_vez(args, timeout_s, prompt, env=env_b)
    _notificar_troca_de_conta(_mensagem_erro(resultado))

    if resultado_b.returncode != 0 and _e_rate_limit(resultado_b):
        diagnostico = (
            f"[RATE LIMIT] Tanto a conta principal quanto a secundária bateram "
            f"o limite de uso. Detalhe (principal): {_mensagem_erro(resultado)[:300]} "
            f"| Detalhe (secundária): {_mensagem_erro(resultado_b)[:300]}"
        )
        raise TarefaEscalada(motivo="rate limit em ambas as contas", diagnostico=diagnostico)

    return resultado_b


def classificar(
    container: str,
    aplicacao_sugerida: str,
    mensagem_normalizada: str,
    mensagem_bruta: str,
    shortlist: list[dict],
) -> dict:
    prompt = PROMPT_TEMPLATE.format(
        container=container,
        aplicacao_sugerida=aplicacao_sugerida,
        mensagem_normalizada=mensagem_normalizada,
        mensagem_bruta=mensagem_bruta[:2000],  # limite de tamanho, evita prompt gigante
        shortlist_formatada=_formatar_shortlist(shortlist),
    )

    resultado = _rodar(
        ["claude", "-p", prompt, "--output-format", "json"], timeout_s=120, prompt=prompt,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"claude CLI falhou: {_mensagem_erro(resultado)[:500]}")

    envelope = json.loads(resultado.stdout)
    custo_usd = envelope.get("total_cost_usd")
    texto_resposta = envelope.get("result", "")
    classificacao = _extrair_json(texto_resposta)

    _validar(classificacao)
    classificacao["_custo_usd"] = custo_usd
    return classificacao


PROMPT_EXECUCAO_WRAPPER = """Você vai executar uma correção JÁ APROVADA por um \
humano — não decida uma abordagem alternativa, não investigue de novo, não \
mude o escopo. Sua única tarefa é aplicar exatamente o que está descrito \
abaixo e reportar o resultado.

{prompt_execucao}

Regras (CATALOGO-ERROS.md, seção de segurança):
- Só execute ações do catálogo fechado (CHECK_*, RESTART_CONTAINER, \
CLEAR_BUILD_CACHE, APPLY_MIGRATION, FIX_CODE_AND_DEPLOY, VERIFICAR_MEMORIA, \
VERIFICAR_CONFIG_DUPLICADA, CRIAR_SWAP, CORRIGIR_CONFIG_DUPLICADA, \
ESCALATE_HUMAN).
- Se a correção envolver código: commit + push, e rode o deploy.sh do erp_itp.
- Se a correção envolver schema de banco: aplique via migration idempotente \
(ADD COLUMN IF NOT EXISTS etc.), nunca DROP/ALTER destrutivo.
- CRIAR_SWAP: só se a memória realmente estiver crítica (sem margem real, \
não só "available" baixo por cache reclamável) e não existir swap já \
configurado. Tamanho conservador (1-2GB), sempre com entrada persistente \
no /etc/fstab. CORRIGIR_CONFIG_DUPLICADA: sempre faça backup do arquivo \
antes de editar (ex: cp arquivo arquivo.bak-<data>).
- Depois de aplicar, valide se o erro realmente sumiu (reproduza a consulta/
condição que causava o erro, se possível).
- Se em qualquer momento a correção não for tão simples quanto parecia, ou \
exigir uma decisão que não estava no escopo aprovado, PARE e reporte \
precisa_atencao_humana=true em vez de improvisar.

Responda ESTRITAMENTE com um objeto JSON válido, sem markdown, sem texto \
antes ou depois:

{{
  "sucesso": <true se a correção foi aplicada e validada, false caso contrário>,
  "resumo": "<o que foi feito, em 1-3 frases>",
  "acao_realizada": "<descrição curta e específica da ação concreta, no \
estilo de mensagem de commit — ex: 'Adicionado cast ::uuid em 3 inserts \
SQL de turma_alunos' ou 'Migration v24: coluna alergias_descricao em \
alunos/inscricoes'. NÃO use o código genérico do catálogo (FIX_CODE_AND_DEPLOY \
etc.) aqui — isso é texto específico do que você de fato mudou.>",
  "link_commit": "<URL do commit no GitHub, ou null se não houve commit>",
  "precisa_atencao_humana": <true se travou em algo que exige decisão humana>
}}"""


def executar(prompt_execucao: str) -> dict:
    """Chamada da etapa de RESOLUÇÃO (pós-aprovação) — diferente de
    classificar(), que só investiga/propõe. Aqui o Claude Code CLI de fato
    aplica a correção (commit, deploy, migration), sempre dentro do escopo
    já aprovado por humano (nunca decide sozinho o que fazer)."""
    prompt = PROMPT_EXECUCAO_WRAPPER.format(prompt_execucao=prompt_execucao)

    resultado = _rodar(
        # --allowedTools: só aqui, nunca em classificar(). A aprovação
        # humana já aconteceu (Power Automate) antes de chegar neste ponto
        # — é o que substitui a confirmação interativa que o Claude Code
        # CLI pediria por padrão pra cada Edit/Bash. Escopo deliberadamente
        # restrito às 3 ferramentas que a execução de correção usa, em vez
        # de liberar tudo. Achado em teste real (2026-09-10): sem isso,
        # toda tentativa de escrever arquivo/rodar comando é bloqueada,
        # mesmo com diagnóstico e correção corretos.
        ["claude", "-p", prompt, "--output-format", "json",
         "--allowedTools", "Edit,Write,Bash"],
        timeout_s=TIMEOUT_MAXIMO_S,  # teto de 5min (decisao 2026-09-15) -- se a
        # correcao real precisar de mais tempo que isso, e' sinal de que e'
        # complexa demais pra automacao decidir sozinha; melhor escalar.
        prompt=prompt,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"claude CLI falhou na execução: {_mensagem_erro(resultado)[:500]}")

    envelope = json.loads(resultado.stdout)
    custo_usd = envelope.get("total_cost_usd")
    texto_resposta = envelope.get("result", "")
    execucao = _extrair_json(texto_resposta)

    if "sucesso" not in execucao or "resumo" not in execucao:
        raise ValueError(f"Resposta de execução fora do schema esperado: {execucao}")

    execucao["_custo_usd"] = custo_usd
    return execucao


def _validar(c: dict) -> None:
    """Falha alto e claro se o Claude devolver algo fora do vocabulário —
    melhor quebrar aqui do que gravar lixo na SharePoint List."""
    erros = []
    if c.get("categoria") not in CATEGORIAS_VALIDAS:
        erros.append(f"categoria inválida: {c.get('categoria')}")
    if c.get("criticidade") not in CRITICIDADES_VALIDAS:
        erros.append(f"criticidade inválida: {c.get('criticidade')}")
    if c.get("ia_pode_resolver") not in IA_PODE_RESOLVER_VALIDOS:
        erros.append(f"ia_pode_resolver inválido: {c.get('ia_pode_resolver')}")
    if c.get("camada_investigacao") not in CAMADAS_VALIDAS:
        erros.append(f"camada_investigacao inválida: {c.get('camada_investigacao')}")
    if not isinstance(c.get("confianca"), (int, float)) or not (0 <= c["confianca"] <= 10):
        erros.append(f"confianca fora do range 0-10: {c.get('confianca')}")
    # Não valida a semântica da justificativa (impossível por regra fixa),
    # só um piso de sanidade: uma nota de confiança alta com diagnóstico
    # genérico/curto é sinal de que a rubrica não foi aplicada de verdade.
    diagnostico = c.get("diagnostico", "") or ""
    if isinstance(c.get("confianca"), (int, float)) and c["confianca"] >= 7 and len(diagnostico) < 40:
        erros.append(
            f"confianca alta ({c['confianca']}) com diagnostico curto demais "
            f"({len(diagnostico)} caracteres) pra justificar a rubrica"
        )
    if erros:
        raise ValueError("Resposta do Claude fora do schema esperado: " + "; ".join(erros))
