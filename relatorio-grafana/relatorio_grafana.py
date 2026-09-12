#!/usr/bin/env python3
"""Relatorio consolidado do Grafana - renderiza os 5 dashboards do ITP em
PNG (via grafana-image-renderer) e manda um unico email com todos anexados.

Uso: python3 relatorio_grafana.py
Pensado pra rodar via cron (ITP_TEC), a cada 3 dias.

Pre-requisitos na VM:
- ~/itp-stack/relatorio_grafana.env com GRAFANA_ADMIN_PASSWORD,
  MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET (reaproveita o app SSO,
  ja tem Mail.Send Application consentido - mesmo usado pelo erp_itp_backend)
"""
from __future__ import annotations  # PEP 604 - VM roda Python 3.9

import base64
import os
from datetime import datetime, timezone

import requests

ENV_PATH = os.path.expanduser("~/itp-stack/relatorio_grafana.env")
GRAFANA_URL = "http://127.0.0.1:3030"
MAILBOX_ORIGEM = "projetos@institutotiapretinha.org"
DESTINATARIO = "monitoramento@institutotiapretinha.org"

DASHBOARDS = [
    ("itp-visao-geral", "ITP — Visão Geral"),
    ("itp-servidor", "ITP — Servidor (detalhado)"),
    ("itp-containers", "ITP — Containers (detalhado)"),
    ("itp-banco-dados", "ITP — Banco de Dados (detalhado)"),
    ("itp-kpi-business", "KPI BUSINESS - ITP"),
]


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def carregar_env() -> dict:
    valores = {}
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, valor = linha.split("=", 1)
            valores[chave.strip()] = valor.strip()
    obrigatorias = ["GRAFANA_ADMIN_PASSWORD", "MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"]
    faltando = [k for k in obrigatorias if k not in valores]
    if faltando:
        raise RuntimeError(f"Faltam variáveis no {ENV_PATH}: {faltando}")
    return valores


def renderizar_dashboard(uid: str, senha_admin: str) -> bytes:
    resp = requests.get(
        f"{GRAFANA_URL}/render/d/{uid}/{uid}",
        params={"width": 1200, "height": 900, "kiosk": ""},
        auth=("admin", senha_admin),
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content


def token_graph(cfg: dict) -> str:
    resp = requests.post(
        f"https://login.microsoftonline.com/{cfg['MS_TENANT_ID']}/oauth2/v2.0/token",
        data={
            "client_id": cfg["MS_CLIENT_ID"],
            "client_secret": cfg["MS_CLIENT_SECRET"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def montar_corpo_html(nomes: list[str]) -> str:
    itens = "".join(f"<li>{nome}</li>" for nome in nomes)
    agora = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    return (
        f"<p>Relatório consolidado do Grafana — gerado em {agora}.</p>"
        f"<p>Dashboards em anexo (imagem):</p><ul>{itens}</ul>"
        f"<p>Ver ao vivo, com histórico e drill-down: "
        f"<a href='https://grafana.itp.institutotiapretinha.org'>grafana.itp.institutotiapretinha.org</a></p>"
    )


def enviar_email(cfg: dict, anexos: list[tuple[str, bytes]]) -> None:
    token = token_graph(cfg)
    nomes = [nome for nome, _ in anexos]
    mensagem = {
        "message": {
            "subject": f"Relatório Grafana ITP — {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
            "body": {"contentType": "HTML", "content": montar_corpo_html(nomes)},
            "toRecipients": [{"emailAddress": {"address": DESTINATARIO}}],
            "attachments": [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": f"{nome.replace(' ', '_').replace('—', '-')}.png",
                    "contentType": "image/png",
                    "contentBytes": base64.b64encode(conteudo).decode("ascii"),
                }
                for nome, conteudo in anexos
            ],
        },
        "saveToSentItems": "false",
    }
    resp = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{MAILBOX_ORIGEM}/sendMail",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=mensagem,
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Falha ao enviar email: {resp.status_code} {resp.text[:500]}")


def main() -> None:
    cfg = carregar_env()
    anexos = []
    for uid, nome in DASHBOARDS:
        log(f"Renderizando {nome}...")
        try:
            png = renderizar_dashboard(uid, cfg["GRAFANA_ADMIN_PASSWORD"])
            anexos.append((nome, png))
            log(f"  ok, {len(png)} bytes")
        except Exception as exc:
            log(f"  falhou: {exc} — segue sem esse dashboard, nao aborta o relatorio inteiro")

    if not anexos:
        raise RuntimeError("nenhum dashboard renderizado com sucesso, nao ha o que enviar")

    log(f"Enviando email pra {DESTINATARIO} com {len(anexos)} anexo(s)...")
    enviar_email(cfg, anexos)
    log("Relatório enviado com sucesso.")


if __name__ == "__main__":
    main()
