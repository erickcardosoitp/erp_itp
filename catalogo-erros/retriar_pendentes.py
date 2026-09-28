"""Passa pela triagem do Jev os itens da catalogoErros que ficaram
'pendente de triagem' (Categoria=pendente) -- criados pelo coletor em modo
--sem-ia ou quando o Jev estava indisponível.

Uso: python3 retriar_pendentes.py [--dry-run]
"""
from __future__ import annotations  # PEP 604 (X | None) — VM roda Python 3.9

import argparse
from datetime import datetime, timezone

import requests

import config
import jev_client
from base_conhecimento import BaseConhecimento
from graph_client import GraphClient


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Só mostra a triagem, sem gravar")
    args = parser.parse_args()

    cfg = config.carregar_env()
    client = GraphClient(cfg)
    base = BaseConhecimento(client)
    api_key = cfg.get("JEV_API_KEY")
    if not api_key:
        raise SystemExit("JEV_API_KEY ausente no catalogo_erros.env")

    itens, url = [], client._items_url("?expand=fields&$top=500")
    while url:
        dados = requests.get(url, headers=client._headers(), timeout=30).json()
        itens += dados["value"]
        url = dados.get("@odata.nextLink")
    pendentes = [i for i in itens if i["fields"].get("Categoria") == "pendente"]
    print(f"{len(pendentes)} item(ns) pendente(s) de triagem")

    for item in pendentes:
        f = item["fields"]
        aplicacao = f.get("Aplicacao") or "ITP"
        ocorrencias = int(f.get("Ocorrencias") or 1)
        ultima = f.get("UltimaVez") or datetime.now(timezone.utc).isoformat()
        c = jev_client.triar(api_key, base, aplicacao, "retriagem", f.get("Assinatura") or f.get("Title") or "",
                             f.get("MensagemExemplo") or f.get("Title") or "", ocorrencias)
        print(f"{f.get('CodErro')}: {c['criticidade']} / {c['ia_pode_resolver']} / ticket {c['cod_problema'] or 'novo'} | {(f.get('MensagemExemplo') or '')[:90]}")
        if args.dry_run:
            continue
        cod = c["cod_problema"]
        if cod:
            base.registrar_ocorrencia(cod, ocorrencias, ultima, incidente_novo=True)
        else:
            cod = base.criar_ticket(jev_client.campos_ticket_novo(c, aplicacao, ultima, ocorrencias))
        resolvido = c["ia_pode_resolver"] == "sem risco"
        client.atualizar_item(item["id"], {
            "Title": c["tipo_erro"][:255], "TipoErro": c["tipo_erro"], "Categoria": c["categoria"],
            "Descri_x00e7__x00e3_oResumida": c["descricao_resumida"], "Criticidade": c["criticidade"],
            "Diagnostico": c["diagnostico"], "CorrecaoProposta": c["correcao_proposta"],
            "IAPodeResolver": c["ia_pode_resolver"], "Confianca": c["confianca"],
            "CamadaInvestigacao": c["camada_investigacao"], "CodProblema": cod,
            "Fase": "resolvido" if resolvido else "diagnosticado", "Status": "resolvido" if resolvido else "aberto",
        })


if __name__ == "__main__":
    main()
