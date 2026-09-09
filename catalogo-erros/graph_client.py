"""Cliente mínimo pra Microsoft Graph API — só o que o coletor precisa:
token app-only, ler/criar/atualizar itens da SharePoint List CatalogoErros.

Autenticação: client credentials flow com o app registration dedicado
'Catalogo Erros - VM' (Sites.ReadWrite.All, Application). Sempre saída da
VM, nunca o Power Automate chamando pra dentro — decisão registrada no
spec (seção 3 do CATALOGO-ERROS.md).
"""
from __future__ import annotations  # PEP 604 (X | None) — VM roda Python 3.9

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


class GraphClient:
    def __init__(self, cfg: dict):
        self.tenant_id = cfg["MS_TENANT_ID"]
        self.client_id = cfg["MS_CLIENT_ID"]
        self.client_secret = cfg["MS_CLIENT_SECRET"]
        self.site_id = cfg["SHAREPOINT_SITE_ID"]
        self.list_id = cfg["SHAREPOINT_LIST_ID"]
        self._token = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        resp = requests.post(
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
            timeout=30,
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
            # Necessário porque Assinatura/CodErro não são colunas indexadas
            # — lista pequena hoje, aceitável emitir esse aviso.
            "Prefer": "HonorNonIndexedQueriesWarningMayFailRandomly",
        }

    def _items_url(self, suffix: str = "") -> str:
        return f"{GRAPH_BASE}/sites/{self.site_id}/lists/{self.list_id}/items{suffix}"

    def buscar_por_assinatura(self, aplicacao: str, assinatura: str) -> dict | None:
        """Camada 2 do dedup: busca exata. Devolve os fields do item se achar,
        None se não achar. Escapa aspas simples pro OData não quebrar."""
        assinatura_escapada = assinatura.replace("'", "''")
        aplicacao_escapada = aplicacao.replace("'", "''")
        filtro = (
            f"fields/Aplicacao eq '{aplicacao_escapada}' and "
            f"fields/Assinatura eq '{assinatura_escapada}'"
        )
        params = {"$expand": "fields", "$filter": filtro, "$top": "1"}
        resp = requests.get(self._items_url(), headers=self._headers(), params=params, timeout=30)
        resp.raise_for_status()
        valores = resp.json().get("value", [])
        return valores[0] if valores else None

    def listar_shortlist(self, aplicacao: str, top: int = 20) -> list[dict]:
        """Pra Camada 3 (comparação semântica): itens recentes/abertos da
        mesma aplicação, só os campos que o Claude precisa pra comparar."""
        aplicacao_escapada = aplicacao.replace("'", "''")
        filtro = f"fields/Aplicacao eq '{aplicacao_escapada}' and fields/Status ne 'descartado'"
        params = {
            "$expand": "fields($select=CodErro,TipoErro,Assinatura,Categoria)",
            "$filter": filtro,
            "$top": str(top),
            "$orderby": "fields/UltimaVez desc",
        }
        resp = requests.get(self._items_url(), headers=self._headers(), params=params, timeout=30)
        resp.raise_for_status()
        return [item["fields"] for item in resp.json().get("value", [])]

    def criar_item(self, fields: dict) -> dict:
        resp = requests.post(
            self._items_url(), headers=self._headers(), json={"fields": fields}, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    def atualizar_item(self, item_id: str, fields: dict) -> None:
        resp = requests.patch(
            self._items_url(f"/{item_id}/fields"),
            headers=self._headers(),
            json=fields,
            timeout=30,
        )
        resp.raise_for_status()
