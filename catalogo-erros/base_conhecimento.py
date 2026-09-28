"""Consulta a base de conhecimento do catálogo no SharePoint (site
ObservabilidadeITP): documentos em Documentos/BaseConhecimento e tickets
da lista TicketsProblema. Tudo sob demanda pelo Graph, sem cópia local --
o que o analista mudar no SharePoint vale na próxima rodada.

Spec: BaseConhecimento/03-Implementacoes/2026-09-28-triagem-jev/spec.md
"""
from __future__ import annotations  # PEP 604 (X | None) — VM roda Python 3.9

import re

import requests

from graph_client import GRAPH_BASE, GraphClient

LISTA_TICKETS = "TicketsProblema"
PASTA_BASE = "BaseConhecimento"

# Aplicacao do catálogo (vem do container) -> Sistema da taxonomia de tickets.
SISTEMA_POR_APLICACAO = {"APRXM": "APRXM", "ITP": "ERP-ITP", "BD": "Banco", "DW": "DW", "SITE": "Site"}
# Infra e Banco são compartilhados: todo erro pode pertencer a um ticket deles.
SISTEMAS_COMPARTILHADOS = ("Infra", "Banco")

CAMPOS_TICKET = (
    "CodProblema", "Title", "Sistema", "Modulo", "Camada", "Natureza", "Disposicao", "Criticidade",
    "CausaRaiz", "Impacto", "Remediacao", "Estado", "RevisadoPor", "QtdIncidentes", "QtdOcorrencias",
)


class BaseConhecimento:
    def __init__(self, client: GraphClient):
        self.client = client
        self._site = f"{GRAPH_BASE}/sites/{client.site_id}"
        self._docs: dict[str, str] = {}
        self._tickets: list[dict] | None = None
        self._exemplos: dict[str, list[str]] | None = None
        self._drive_id: str | None = None

    def _get(self, url: str) -> requests.Response:
        resp = requests.get(url, headers=self.client._headers(), timeout=30)
        resp.raise_for_status()
        return resp

    def documento(self, caminho: str) -> str:
        """Texto de um .md da BaseConhecimento (ex: '00-Regras/regras-classificacao.md').
        Devolve '' se não existir -- sistema sem contexto escrito não pode travar a triagem."""
        if caminho not in self._docs:
            if self._drive_id is None:
                self._drive_id = self._get(f"{self._site}/drive").json()["id"]
            url = f"{GRAPH_BASE}/drives/{self._drive_id}/root:/{PASTA_BASE}/{caminho}:/content"
            resp = requests.get(url, headers=self.client._headers(), timeout=30)
            self._docs[caminho] = resp.text if resp.ok else ""
        return self._docs[caminho]

    def contexto_sistema(self, aplicacao: str) -> str:
        sistema = SISTEMA_POR_APLICACAO.get(aplicacao, aplicacao)
        return self.documento(f"01-Sistemas/{sistema}/contexto.md")

    def _todos_tickets(self) -> list[dict]:
        if self._tickets is None:
            itens, url = [], f"{self._site}/lists/{LISTA_TICKETS}/items?expand=fields&$top=500"
            while url:
                dados = self._get(url).json()
                itens += dados["value"]
                url = dados.get("@odata.nextLink")
            self._tickets = [{"id": i["id"], **{k: i["fields"].get(k) for k in CAMPOS_TICKET}} for i in itens]
        return self._tickets

    def tickets_candidatos(self, aplicacao: str) -> list[dict]:
        sistemas = {SISTEMA_POR_APLICACAO.get(aplicacao, aplicacao), *SISTEMAS_COMPARTILHADOS}
        return [t for t in self._todos_tickets() if t.get("Sistema") in sistemas]

    def exemplos(self, cod: str, limite: int = 3) -> list[str]:
        """Mensagens reais de incidentes da catalogoErros já vinculados ao ticket."""
        if self._exemplos is None:
            self._exemplos = {}
            url = self.client._items_url("?expand=fields($select=CodProblema,MensagemExemplo)&$top=500")
            while url:
                dados = self._get(url).json()
                for i in dados["value"]:
                    f = i["fields"]
                    if f.get("CodProblema") and f.get("MensagemExemplo"):
                        self._exemplos.setdefault(f["CodProblema"], []).append(f["MensagemExemplo"][:200])
                url = dados.get("@odata.nextLink")
        return self._exemplos.get(cod, [])[:limite]

    def ticket(self, cod: str) -> dict | None:
        return next((t for t in self._todos_tickets() if t.get("CodProblema") == cod), None)

    def criar_ticket(self, fields: dict) -> str:
        """Cria ticket novo com o próximo PRB-NNNN livre. Devolve o código."""
        numeros = [int(m.group(1)) for t in self._todos_tickets()
                   if (m := re.match(r"PRB-(\d+)$", t.get("CodProblema") or ""))]
        cod = f"PRB-{(max(numeros) + 1 if numeros else 1):04d}"
        resp = requests.post(f"{self._site}/lists/{LISTA_TICKETS}/items", headers=self.client._headers(),
                             json={"fields": {**fields, "CodProblema": cod}}, timeout=30)
        resp.raise_for_status()
        self._tickets.append({"id": resp.json()["id"], **fields, "CodProblema": cod})
        return cod

    def registrar_ocorrencia(self, cod: str, ocorrencias: int, ultima_iso: str, incidente_novo: bool) -> None:
        """Atualiza contadores do ticket; reabre se já estava resolvido/encerrado."""
        t = self.ticket(cod)
        if not t:
            return
        fields = {
            "QtdOcorrencias": int(t.get("QtdOcorrencias") or 0) + ocorrencias,
            "UltimaOcorrencia": ultima_iso,
        }
        if incidente_novo:
            fields["QtdIncidentes"] = int(t.get("QtdIncidentes") or 0) + 1
        if t.get("Estado") in ("resolvido", "encerrado"):
            fields["Estado"] = "reaberto"
        requests.patch(f"{self._site}/lists/{LISTA_TICKETS}/items/{t['id']}/fields",
                       headers=self.client._headers(), json=fields, timeout=30).raise_for_status()
        t.update(fields)
