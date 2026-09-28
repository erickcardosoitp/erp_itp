"""Triagem de erro novo com o Jev (TypeSafe, POST /v1/systemone): uma
chamada com perguntas tipadas em paralelo, contexto vindo da base de
conhecimento no SharePoint. Substitui a classificação pelo Claude
(claude_client.classificar) no coletor.

O Jev decide só o que é ambíguo. Travas e limites de confiança ficam no
código e valem acima de qualquer resposta da IA ("na dúvida, escalar").
Spec: BaseConhecimento/03-Implementacoes/2026-09-28-triagem-jev/spec.md
"""
from __future__ import annotations  # PEP 604 (X | None) — VM roda Python 3.9

import re

import requests

from base_conhecimento import BaseConhecimento

JEV_URL = "https://api.typesafe.ai/v1/systemone"
JEV_MODELO = "jev-latest"

# Limites de confiança (calibrar contra os tickets revisados).
CONFIANCA_MIN_TICKET = 0.5
# Com trava, vínculo errado é mais caro (ex: violação de association_id ligada
# ao ticket benigno da restauração do banco, confiança 0.52 no teste de 29/09).
CONFIANCA_MIN_TICKET_COM_TRAVA = 0.75
CONFIANCA_MIN_CRITICIDADE = 0.6
CONFIANCA_MIN_FECHAR = 0.85

NIVEIS = ["baixa", "media", "alta", "critica"]

# Códigos de cor ANSI (Traefik/Grafana) atrapalham a leitura do Jev; às vezes
# o ESC já foi removido e sobra só "[31m".
_ANSI = re.compile(r"\x1b?\[[0-9;]*m")

TRAVAS_REGEX = {
    "association-id": r"association_id|tenant",
    "dinheiro": r"caixa|cash_|sangria|transac|transaction|mensalidad|cobran|pagamento|payment|boleto|financeir|payable|conta_pagar",
    "dado-pessoal": r"\bcpf\b|lgpd|senha|password|responsave|aluno",
}

NATUREZAS = {
    "bug": "defeito no código da aplicação",
    "migration": "schema divergente do código, migration ausente ou não idempotente",
    "infra": "container, rede, DNS, proxy, recursos da VM",
    "operacao": "uso: dado digitado errado, ação manual, erro de operador",
    "regra-negocio": "o sistema bloqueou de propósito uma ação inválida",
    "ataque-varredura": "bots, scanners, tentativas de acesso",
    "terceiros": "comportamento interno de ferramenta de terceiros (Grafana, Traefik)",
    "efeito-deploy": "consequência de deploy, restauração ou migração de servidor",
}
CRITERIOS_CRITICIDADE = {
    "critica": "perda ou corrupção de dado, dinheiro errado, vazamento de dado pessoal, sistema ou tela principal fora do ar para todos",
    "alta": "fluxo principal quebrado para parte dos usuários, crash recorrente, notificação essencial parada",
    "media": "falha real com contorno, ou em fluxo secundário",
    "baixa": "sem impacto para o usuário: ruído, cosmético, comportamento esperado",
}

# Natureza/camada do Jev -> opções da coluna Categoria da catalogoErros.
CATEGORIA_POR_NATUREZA = {"ataque-varredura": "security", "operacao": "usuario", "regra-negocio": "usuario", "terceiros": "terceiros"}
CATEGORIA_POR_CAMADA = {"banco": "banco", "backend": "codigo", "frontend": "codigo", "infra": "infra", "terceiros": "terceiros"}
CAMADA_INVESTIGACAO = {"banco": "schema_banco", "infra": "infra_vm", "terceiros": "integracao_ext"}


class JevIndisponivel(Exception):
    """Falha de rede/HTTP no Jev -- o coletor registra como pendente de triagem."""


def _perguntas(candidatos: list[dict], base: BaseConhecimento) -> dict:
    tickets = {t["CodProblema"]: {"titulo": t.get("Title") or "", "causa": (t.get("CausaRaiz") or "")[:300],
                                  "exemplos": base.exemplos(t["CodProblema"])} for t in candidatos}
    tickets["nenhum"] = {"titulo": "o erro não pertence a nenhum destes problemas", "causa": "", "exemplos": []}
    return {
        "ticket": {"type": "choice", "instructions": {
            "question": "A qual problema conhecido pertence `erro.mensagem`? Use a mesma causa raiz, não só palavras parecidas.",
        }, "criteria": tickets},
        "natureza": {"type": "choice", "instructions": "Considerando `regras` e `contexto_sistema`, qual a natureza de `erro.mensagem`?", "criteria": NATUREZAS},
        "camada": {"type": "choice", "instructions": "Em qual camada `erro.mensagem` se origina?",
                   "criteria": {"frontend": None, "backend": None, "banco": None, "infra": None, "terceiros": None}},
        "criticidade": {"type": "choice", "instructions": "Considerando `regras` e `contexto_sistema`, qual a criticidade de `erro.mensagem`? Ruído e comportamento esperado são sempre baixa.", "criteria": CRITERIOS_CRITICIDADE},
        "afeta_usuario": {"type": "noul", "instructions": "`erro.mensagem` indica que a tela ou o fluxo de um usuário real quebrou?"},
        "trava_association": {"type": "noul", "instructions": "`erro.mensagem` envolve isolamento entre associações (association_id, tenant, dado de uma associação em outra)?"},
        "trava_dinheiro": {"type": "noul", "instructions": "`erro.mensagem` envolve dinheiro (caixa, sangria, transações, mensalidades, cobrança, financeiro)?"},
        "trava_dado_pessoal": {"type": "noul", "instructions": "`erro.mensagem` envolve dado pessoal (CPF, endereço, telefone, aluno, família, credenciais)?"},
        "acao": {"type": "choice", "instructions": "Considerando `regras` e `contexto_sistema`, qual a ação correta para `erro.mensagem`?",
                 "criteria": {"fechar": "ruído conhecido ou comportamento esperado", "monitorar": "real, raro ou sem impacto",
                              "corrigir": "bug real com causa provavelmente localizada e correção simples",
                              "investigar": "bug real, causa incerta ou correção complexa"}},
        "risco_correcao": {"type": "choice", "instructions": "Qual o risco de corrigir `erro.mensagem` automaticamente?",
                           "criteria": {"seguro": "mudança pequena e isolada, sem dado, dinheiro ou schema",
                                        "mediano": "toca fluxo relevante ou mais de um arquivo",
                                        "alto risco": "schema, dado, dinheiro, autenticação ou isolamento"}},
    }


def _chamar(api_key: str, state: dict, perguntas: dict) -> dict:
    try:
        resp = requests.post(JEV_URL, headers={"Authorization": f"Bearer {api_key}"},
                             json={"state": state, "model": JEV_MODELO, "questions": perguntas}, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        raise JevIndisponivel(str(exc)[:300]) from exc


def _escolha(ans: dict, chave: str) -> tuple[str | None, float]:
    a = ans.get(chave) or {}
    return a.get("choice"), float(a.get("confidence") or 0)


def _subir(nivel: str, minimo: str) -> str:
    return NIVEIS[max(NIVEIS.index(nivel), NIVEIS.index(minimo))]


def triar(api_key: str, base: BaseConhecimento, aplicacao: str, container: str,
          msg_normalizada: str, mensagem_bruta: str, ocorrencias: int) -> dict:
    """Devolve a classificação no formato de claude_client.classificar (+ cod_problema)."""
    mensagem_bruta = _ANSI.sub("", mensagem_bruta)
    msg_normalizada = _ANSI.sub("", msg_normalizada)
    candidatos = base.tickets_candidatos(aplicacao)
    state = {
        "erro": {"mensagem": mensagem_bruta[:1500], "normalizada": msg_normalizada[:500],
                 "container": container, "aplicacao": aplicacao, "ocorrencias_no_lote": ocorrencias},
        "regras": base.documento("00-Regras/regras-classificacao.md"),
        "contexto_sistema": base.contexto_sistema(aplicacao),
    }
    resposta = _chamar(api_key, state, _perguntas(candidatos, base))
    ans = resposta.get("answers", {})

    ticket, conf_ticket = _escolha(ans, "ticket")
    natureza, _ = _escolha(ans, "natureza")
    camada, _ = _escolha(ans, "camada")
    criticidade, conf_crit = _escolha(ans, "criticidade")
    acao, conf_acao = _escolha(ans, "acao")
    risco, _ = _escolha(ans, "risco_correcao")
    criticidade = criticidade or "media"

    # Travas: regex no código OU Jev >= 0.5. Nunca fecham, nunca publicam.
    texto = f"{mensagem_bruta} {msg_normalizada}".lower()
    travas = [t for t, rx in TRAVAS_REGEX.items() if re.search(rx, texto)]
    for chave, trava in (("trava_association", "association-id"), ("trava_dinheiro", "dinheiro"), ("trava_dado_pessoal", "dado-pessoal")):
        if float((ans.get(chave) or {}).get("noul") or 0) >= 0.5 and trava not in travas:
            travas.append(trava)

    motivos = []
    if conf_crit < CONFIANCA_MIN_CRITICIDADE:
        criticidade = NIVEIS[min(NIVEIS.index(criticidade) + 1, 3)]
        motivos.append(f"criticidade subiu um nível (confiança {conf_crit:.2f})")

    limite_ticket = CONFIANCA_MIN_TICKET_COM_TRAVA if travas else CONFIANCA_MIN_TICKET
    ticket_info = base.ticket(ticket) if ticket and ticket != "nenhum" and conf_ticket >= limite_ticket else None
    if ticket_info:
        crit_ticket = ticket_info.get("Criticidade") or criticidade
        # Ticket revisado por humano manda; senão vale o maior dos dois.
        criticidade = crit_ticket if ticket_info.get("RevisadoPor") else _subir(criticidade, crit_ticket)
        natureza = ticket_info.get("Natureza") or natureza

    if "association-id" in travas:
        criticidade = _subir(criticidade, "alta")
    elif travas:
        criticidade = _subir(criticidade, "media")

    fechar = acao == "fechar" and conf_acao >= CONFIANCA_MIN_FECHAR and not travas
    if travas:
        ia_pode_resolver = "alto risco"
    elif fechar:
        ia_pode_resolver = "sem risco"
    else:
        ia_pode_resolver = risco if risco in ("seguro", "mediano", "alto risco") else "mediano"

    categoria = CATEGORIA_POR_NATUREZA.get(natureza) or CATEGORIA_POR_CAMADA.get(camada, "codigo")
    titulo = ticket_info["Title"] if ticket_info else f"Novo: {msg_normalizada[:150]}"
    diag = (f"Triagem Jev ({resposta.get('model')}). Ticket: {ticket or '-'} (confiança {conf_ticket:.2f}"
            f"{'' if ticket_info else ', não vinculado'}). Natureza: {natureza}. Camada: {camada}. "
            f"Criticidade: {criticidade} (confiança {conf_crit:.2f}). Ação: {acao} (confiança {conf_acao:.2f}). "
            f"Travas: {', '.join(travas) or 'nenhuma'}." + (f" Ajustes: {'; '.join(motivos)}." if motivos else ""))

    return {
        "eh_reincidencia_de": None,
        "aplicacao": aplicacao,
        "categoria": categoria,
        "tipo_erro": titulo[:255],
        "descricao_resumida": f"{natureza or 'natureza ?'} · {criticidade} · ação {acao or '?'}"[:150],
        "criticidade": criticidade,
        "camada_investigacao": CAMADA_INVESTIGACAO.get(camada, "log_app"),
        "confianca": max(1, round(conf_crit * 10)),
        "ia_pode_resolver": ia_pode_resolver,
        "diagnostico": diag,
        "impacto_avaliado": (ticket_info or {}).get("Impacto") or "Não avaliado (triagem sem ticket vinculado).",
        "correcao_proposta": (ticket_info or {}).get("Remediacao") or "Pendente de investigação.",
        "cod_problema": ticket_info["CodProblema"] if ticket_info else None,
        "_jev": {"natureza": natureza, "camada": camada, "acao": acao, "travas": travas, "usage": resposta.get("usage")},
    }


def campos_ticket_novo(classificacao: dict, aplicacao: str, ultima_iso: str, ocorrencias: int) -> dict:
    """Campos de TicketsProblema para um erro sem ticket existente."""
    j = classificacao["_jev"]
    fields = {
        "Title": classificacao["tipo_erro"],
        "Sistema": {"APRXM": "APRXM", "ITP": "ERP-ITP", "BD": "Banco", "DW": "DW", "SITE": "Site"}.get(aplicacao, "Infra"),
        "Camada": j.get("camada") or "backend",
        "Natureza": j.get("natureza") or "bug",
        "Disposicao": "aceito-conhecido" if classificacao["ia_pode_resolver"] == "sem risco" else "remediar",
        "Criticidade": classificacao["criticidade"],
        "JustificativaCriticidade": classificacao["diagnostico"],
        "Estado": "aberto",
        "QtdIncidentes": 1,
        "QtdOcorrencias": ocorrencias,
        "UltimaOcorrencia": ultima_iso,
        "OrigemClassificacao": "ia",
    }
    if j.get("travas"):
        fields["Travas@odata.type"] = "Collection(Edm.String)"
        fields["Travas"] = j["travas"]
    return fields
