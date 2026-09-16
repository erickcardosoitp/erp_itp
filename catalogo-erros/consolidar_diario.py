"""Consolidação de fim do dia (decisão 2026-09-15, a pedido do analista —
é o "Fluxo B" já previsto desde o design original em CATALOGO-ERROS.md
seção 2/10, nunca construído): cria de verdade, na SharePoint List, todos
os itens de criticidade baixa/média represados no dia inteiro
(staging_diario.py) e manda um único email-resumo terso -- sem detalhar
cada item, só a contagem por criticidade. Itens alta/crítica não passam
por aqui -- esses já foram criados na hora pelo coletor.py, disparando o
fluxo de aprovação em tempo real.

Roda 1x/dia via cron, no fim do dia local
(tarefas_runner.py catalogo-erros-consolidacao-diaria).
"""
from __future__ import annotations

import os
from datetime import datetime

import config
import requests
import staging_diario
from claude_client import registrar_escalonamento
from coletor import _criar_item_novo
from graph_client import GraphClient

DESTINATARIO = "erickcardoso@institutotiapretinha.org"
REMETENTE = "projetos@institutotiapretinha.org"  # mesma caixa usada pelo claude_client.py
LINK_LISTA = "https://insttiapretinha.sharepoint.com/sites/ObservabilidadeITP/Lists/CatalogoErros"


def _montar_html(contagem: dict[str, int]) -> str:
    if not contagem:
        return "<p>Nenhum erro de criticidade baixa/média represado hoje.</p>"
    linhas = "".join(
        f"<li>{qtd} erro(s) de criticidade <b>{crit}</b></li>"
        for crit, qtd in sorted(contagem.items())
    )
    return (
        f"<p>Consolidação diária enviada à lista do catálogo:</p><ul>{linhas}</ul>"
        f"<p>Acesse <a href='{LINK_LISTA}'>a lista do SharePoint</a> pra revisar e decidir "
        "o que resolver -- correções sem risco já saem marcadas como resolvidas; "
        "as demais só precisam trocar Status pra \"aprovado\" quando você decidir.</p>"
    )


def main() -> None:
    try:
        _consolidar()
    except Exception as exc:
        # Achado real 2026-09-15: a 1ª execução de verdade quebrou no
        # envio do email (403, credencial errada) sem nenhum registro
        # além do traceback cru no log do cron -- ninguém saberia sem
        # entrar na VM manualmente. Agora ao menos fica registrado no
        # mesmo lugar que timeout/rate-limit do Claude CLI (embora a
        # causa aqui nunca seja o Claude CLI em si).
        registrar_escalonamento(
            "consolidar_diario", "consolidacao_noturna", str(exc),
            f"Falha na consolidação diária: {type(exc).__name__}: {exc}",
        )
        raise


def _consolidar() -> None:
    cfg = config.carregar_env()
    client = GraphClient(cfg)
    staged = staging_diario.listar_tudo()

    contagem: dict[str, int] = {}
    for entrada in staged.values():
        classificacao = entrada["classificacao"]
        primeiro_ts = datetime.fromisoformat(entrada["primeiro_timestamp"])
        ultimo_ts = datetime.fromisoformat(entrada["ultimo_timestamp"])
        _criar_item_novo(
            client,
            classificacao["aplicacao"],
            entrada["msg_normalizada"],
            [entrada["exemplo"]],
            entrada["qtd"],
            primeiro_ts,
            ultimo_ts,
            classificacao,
            cod_erro=entrada["cod_erro"],
        )
        crit = classificacao.get("criticidade", "?")
        contagem[crit] = contagem.get(crit, 0) + 1

    staging_diario.limpar()

    # Achado real 2026-09-15 (1ª execução de verdade, à noite): o app
    # "Catalogo Erros - VM" (catalogo_erros.env, usado acima só pro
    # GraphClient/SharePoint) só tem permissão Sites.ReadWrite.All, sem
    # Mail.Send -- usar cfg (dele) pro token de email dava 403 Forbidden
    # no sendMail, silenciosamente (todos os itens já tinham sido criados
    # na lista, só o email de aviso que nunca saía). O app que de fato
    # manda email é outro, carregado à parte, mesmo padrão já usado em
    # claude_client.py::_notificar_troca_de_conta.
    cfg_email = {}
    with open(os.path.expanduser("~/itp-stack/relatorio_grafana.env"), "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            cfg_email[k.strip()] = v.strip()

    token_resp = requests.post(
        f"https://login.microsoftonline.com/{cfg_email['MS_TENANT_ID']}/oauth2/v2.0/token",
        data={
            "client_id": cfg_email["MS_CLIENT_ID"],
            "client_secret": cfg_email["MS_CLIENT_SECRET"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=30,
    )
    token_resp.raise_for_status()
    token = token_resp.json()["access_token"]

    total = sum(contagem.values())
    mensagem = {
        "message": {
            "subject": f"[Catálogo de Erros] Consolidação diária — {total} item(ns) baixa/média",
            "body": {"contentType": "HTML", "content": _montar_html(contagem)},
            "toRecipients": [{"emailAddress": {"address": DESTINATARIO}}],
        },
        "saveToSentItems": "false",
    }
    resp = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{REMETENTE}/sendMail",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=mensagem,
        timeout=30,
    )
    resp.raise_for_status()
    print(f"Consolidação diária concluída: {total} item(ns) criado(s) na lista, email enviado.")


if __name__ == "__main__":
    main()
