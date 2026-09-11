"""Wrapper pro Claude Code CLI headless (`claude -p`). Só é chamado na
Camada 3 do dedup (spec seção 6) — quando a busca exata (Camada 2) não
achou nada, ou seja, só pra erro genuinamente novo/ambíguo. Reincidência
exata nunca gasta chamada de IA.

Responsabilidade única do Claude aqui: classificar + decidir se é o
mesmo problema de algo já no shortlist. Nunca escolhe/executa ação
(catálogo fechado, seção 7 do spec) — isso é responsabilidade de uma
etapa posterior, separada, só depois de aprovação humana.
"""
import json
import os
import re
import subprocess

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
    """O Claude às vezes envolve a resposta em ```json ... ``` mesmo quando
    pedimos JSON puro — remove isso antes de fazer o parse."""
    texto = texto.strip()
    texto = re.sub(r"^```(json)?\s*", "", texto)
    texto = re.sub(r"\s*```$", "", texto)
    return json.loads(texto)


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

    resultado = subprocess.run(
        ["claude", "-p", prompt, "--output-format", "json"],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=DIRETORIO_REPO,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"claude CLI falhou: {resultado.stderr[:500]}")

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

    resultado = subprocess.run(
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
        capture_output=True,
        text=True,
        timeout=600,  # execução real (commit/deploy) demora mais que classificação
        cwd=DIRETORIO_REPO,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"claude CLI falhou na execução: {resultado.stderr[:500]}")

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
