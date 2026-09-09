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
import re
import subprocess

CATEGORIAS_VALIDAS = {"banco", "codigo", "infra", "seguranca", "usuario", "integracao"}
CRITICIDADES_VALIDAS = {"baixa", "media", "alta", "critica"}
IA_PODE_RESOLVER_VALIDOS = {"sim_seguro", "sim_com_risco", "nao"}
CAMADAS_VALIDAS = {"log_app", "schema_banco", "infra_vm", "integracao_externa"}

PROMPT_TEMPLATE = """Você está classificando um erro capturado nos logs da VM \
vm-itp-prod, pro catálogo automático de erros descrito em CATALOGO-ERROS.md \
do repositório erp_itp. Responda ESTRITAMENTE com um objeto JSON válido, \
sem markdown, sem texto antes ou depois.

## Contexto do erro

Container/origem: {container}
Aplicação sugerida (você pode confirmar ou trocar por "BD" se for erro do \
motor do banco em si, não de uma app específica): {aplicacao_sugerida}
Mensagem normalizada (timestamps/IDs/UUIDs já removidos): {mensagem_normalizada}
Mensagem bruta de exemplo: {mensagem_bruta}

## Itens já catalogados dessa mesma aplicação (pra você checar se é o mesmo problema)

{shortlist_formatada}

## O que responder (JSON exato, sem campos a mais nem a menos)

{{
  "eh_reincidencia_de": "<CodErro do shortlist acima, se for essencialmente \
o mesmo problema com confiança alta, ou null se for genuinamente novo>",
  "aplicacao": "<ITP, APRXM, DW ou BD>",
  "categoria": "<uma de: banco, codigo, infra, seguranca, usuario, integracao>",
  "tipo_erro": "<rótulo curto e específico, texto livre, ex: 'Divergência de tipo UUID/varchar em FK'>",
  "criticidade": "<uma de: baixa, media, alta, critica>",
  "camada_investigacao": "<uma de: log_app, schema_banco, infra_vm, integracao_externa>",
  "confianca": <número de 0 a 10, quão confiante você está no diagnóstico>,
  "ia_pode_resolver": "<uma de: sim_seguro, sim_com_risco, nao>",
  "diagnostico": "<análise da causa raiz, texto>",
  "correcao_proposta": "<correção sugerida, texto, ou 'Nenhuma ação de código — ruído esperado' se não for bug de verdade>"
}}

Lembre-se: na dúvida sobre "eh_reincidencia_de", prefira null (item novo) \
a forçar uma correspondência errada — fundir dois problemas diferentes é \
pior do que duplicar. Se o erro não representa um bug de verdade (ex: \
exploração manual do banco, ruído de redeploy), diga isso claramente no \
diagnóstico e marque ia_pode_resolver como "nao"."""


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
    if erros:
        raise ValueError("Resposta do Claude fora do schema esperado: " + "; ".join(erros))
