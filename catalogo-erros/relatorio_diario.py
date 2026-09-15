"""Resumo diário dos itens de criticidade baixa/média do catálogo de erros
(decisão 2026-09-15, a pedido do analista): itens alta/crítica continuam
notificando em tempo real via Power Automate (aprovação individual); itens
baixa/média com correção proposta real (ia_pode_resolver != "sem risco" --
esses já auto-resolvem sozinhos, ver coletor.py) ficam represados sem
incomodar ninguém até este resumo, uma vez por dia.

Aprovar um item do resumo é só trocar Status pra "aprovado" na lista do
SharePoint -- PromptExecucao já vem pré-preenchido desde a criação
(coletor.py::_criar_item_novo), então o aplicador.py pega no próximo ciclo
sem precisar de nenhum fluxo do Power Automate pra esse caminho.

Roda 1x/dia via cron (tarefas_runner.py catalogo-erros-relatorio-diario).
"""
from __future__ import annotations

import config
import requests
from graph_client import GraphClient, GRAPH_BASE

DESTINATARIO = "erickcardoso@institutotiapretinha.org"
REMETENTE = "projetos@institutotiapretinha.org"  # mesma caixa usada pelo claude_client.py


def _buscar_itens_pendentes(client: GraphClient) -> list[dict]:
    campos = "CodCat,CodErro,Aplicacao,Categoria,TipoErro,Criticidade,Descri_x00e7__x00e3_oResumida,Diagnostico,CorrecaoProposta,Status,Ocorrencias"
    filtro = "(fields/Criticidade eq 'baixa' or fields/Criticidade eq 'media') and fields/Status eq 'aberto'"
    url = (
        f"{GRAPH_BASE}/sites/{client.site_id}/lists/{client.list_id}/items"
        f"?$expand=fields($select={campos})&$filter={filtro}&$top=200"
    )
    resp = requests.get(url, headers=client._headers(), timeout=30)
    resp.raise_for_status()
    return [item["fields"] for item in resp.json().get("value", [])]


def _montar_html(itens: list[dict]) -> str:
    if not itens:
        return "<p>Nenhum item de criticidade baixa/média pendente hoje.</p>"

    linhas = []
    for f in itens:
        linhas.append(
            "<tr style='border-bottom:1px solid #ddd'>"
            f"<td style='padding:8px'><b>{f.get('CodCat','?')}</b><br>{f.get('CodErro','')}</td>"
            f"<td style='padding:8px'>{f.get('Aplicacao','')}<br>{f.get('Categoria','')}</td>"
            f"<td style='padding:8px'>{f.get('Criticidade','')}</td>"
            f"<td style='padding:8px'>{f.get('TipoErro','')}<br><i>{f.get('Descri_x00e7__x00e3_oResumida','')}</i></td>"
            f"<td style='padding:8px'>{f.get('CorrecaoProposta','')[:400]}</td>"
            f"<td style='padding:8px'>{f.get('Ocorrencias','')}</td>"
            "</tr>"
        )
    return (
        "<p>Itens de criticidade <b>baixa/média</b> aguardando decisão "
        f"({len(itens)} no total). Pra aprovar, abra o item na lista do "
        "SharePoint e mude <b>Status</b> pra <b>aprovado</b> -- a correção "
        "já sai executando no próximo ciclo do aplicador, sem precisar de "
        "mais nada.</p>"
        "<table style='border-collapse:collapse;width:100%;font-family:inherit'>"
        "<tr style='background:#f0f0f0'><th>Item</th><th>App/Categoria</th>"
        "<th>Criticidade</th><th>Tipo/Resumo</th><th>Correção proposta</th>"
        "<th>Ocorrências</th></tr>"
        + "".join(linhas)
        + "</table>"
    )


def main() -> None:
    cfg = config.carregar_env()
    client = GraphClient(cfg)
    itens = _buscar_itens_pendentes(client)

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
            "subject": f"[Catálogo de Erros] Resumo diário — {len(itens)} item(ns) baixa/média pendente(s)",
            "body": {"contentType": "HTML", "content": _montar_html(itens)},
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
    print(f"Resumo diário enviado: {len(itens)} item(ns) baixa/média.")


if __name__ == "__main__":
    main()
