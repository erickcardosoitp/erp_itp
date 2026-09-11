"""API de consulta do histórico de erros (Parquet) — só leitura.

Não substitui a SharePoint List (catálogo operacional editável, onde a
aprovação/resolução acontece). Essa API é a camada analítica descrita em
CATALOGO-ERROS.md seção 8: navegar o histórico, filtrar, ver tendência.

Usa DuckDB embutido lendo o diretório de Parquet direto (sem servidor de
banco) — mesmo motor recomendado no spec original.
"""
import os
import time
from datetime import date
from typing import Optional

import duckdb
import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

PARQUET_BASE_DIR = os.environ.get(
    "PARQUET_BASE_DIR", os.path.expanduser("~/itp-stack/catalogo-erros-parquet")
)

# --- Status ao vivo da SharePoint List (credenciais do app "Catalogo
# Erros - VM", mesmas do coletor.py/aplicador.py, montadas via env_file no
# docker-compose). O Parquet so grava o status NO MOMENTO da ocorrencia -
# se um item e' aprovado/resolvido depois sem gerar ocorrencia nova, o
# Parquet nunca saberia. Achado real, 2026-09-11: itens fechados na lista
# ainda apareciam "aberto" no dashboard por causa disso + de any_value()
# escolher um valor arbitrario do grupo em vez do mais recente.
_MS_TENANT_ID = os.environ.get("MS_TENANT_ID")
_MS_CLIENT_ID = os.environ.get("MS_CLIENT_ID")
_MS_CLIENT_SECRET = os.environ.get("MS_CLIENT_SECRET")
_SHAREPOINT_SITE_ID = os.environ.get("SHAREPOINT_SITE_ID")
_SHAREPOINT_LIST_ID = os.environ.get("SHAREPOINT_LIST_ID")

_cache_status_vivo: dict = {"dados": {}, "expira_em": 0.0}
_CACHE_TTL_S = 30  # nao bate na Graph API a cada request de pagina


def _token_graph() -> Optional[str]:
    if not (_MS_TENANT_ID and _MS_CLIENT_ID and _MS_CLIENT_SECRET):
        return None
    try:
        resp = httpx.post(
            f"https://login.microsoftonline.com/{_MS_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": _MS_CLIENT_ID,
                "client_secret": _MS_CLIENT_SECRET,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
    except httpx.HTTPError:
        return None


def _status_vivo_por_coderro() -> dict:
    """CodErro -> {Status, Fase} direto da SharePoint List, cacheado por
    _CACHE_TTL_S segundos. Falha silenciosa (retorna {}) se Graph
    indisponivel/sem credencial - o dashboard cai de volta pro Parquet."""
    agora = time.time()
    if agora < _cache_status_vivo["expira_em"]:
        return _cache_status_vivo["dados"]

    if not (_SHAREPOINT_SITE_ID and _SHAREPOINT_LIST_ID):
        return {}
    token = _token_graph()
    if not token:
        return {}

    try:
        resp = httpx.get(
            f"https://graph.microsoft.com/v1.0/sites/{_SHAREPOINT_SITE_ID}"
            f"/lists/{_SHAREPOINT_LIST_ID}/items",
            params={"$expand": "fields($select=CodErro,Status,Fase)", "$top": "200"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        resp.raise_for_status()
        dados = {}
        for item in resp.json().get("value", []):
            f = item.get("fields", {})
            cod = f.get("CodErro")
            if cod:
                dados[cod] = {"Status": f.get("Status"), "Fase": f.get("Fase")}
        _cache_status_vivo["dados"] = dados
        _cache_status_vivo["expira_em"] = agora + _CACHE_TTL_S
        return dados
    except httpx.HTTPError:
        return {}
# Padrão Hive: app=X/data=Y/*.parquet — hive_partitioning reconstrói as
# colunas Aplicacao/data a partir do caminho automaticamente.
GLOB_PARQUET = os.path.join(PARQUET_BASE_DIR, "**", "*.parquet")

# Serviço de tarefas roda fora de container, direto no host (unico jeito de
# mexer no crontab real sem hack de UID/permissao) — ver catalogo-erros-viewer/
# tarefas-api/tarefas_api.py. host.docker.internal aponta pro host da VM
# (extra_hosts no docker-compose). SEM AUTENTICACAO AINDA — pendente SSO
# antes de expor esse backend fora de 127.0.0.1/rede interna.
TAREFAS_API_URL = os.environ.get("TAREFAS_API_URL", "http://host.docker.internal:8002")

app = FastAPI(title="Catálogo de Erros — Visualização")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # app interna, sem dado sensível de credencial — ok pra v1
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def conectar():
    con = duckdb.connect(database=":memory:")
    con.execute("SET GLOBAL sqlite_all_varchar=false")
    return con


def _existe_algum_parquet() -> bool:
    if not os.path.isdir(PARQUET_BASE_DIR):
        return False
    for _root, _dirs, files in os.walk(PARQUET_BASE_DIR):
        if any(f.endswith(".parquet") for f in files):
            return True
    return False


def _base_query(con) -> str:
    """Registra a view 'erros' sobre todos os Parquet, e devolve o nome
    da view — centraliza o glob pra não repetir em cada endpoint."""
    con.execute(
        f"""
        CREATE OR REPLACE VIEW erros AS
        SELECT * FROM read_parquet('{GLOB_PARQUET}', hive_partitioning=true)
        """
    )
    return "erros"


@app.get("/api/health")
def health():
    return {"ok": True, "parquet_existe": _existe_algum_parquet()}


@app.get("/api/erros")
def listar_erros(
    aplicacao: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    criticidade: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
):
    """Agrupa por CodErro — cada linha da resposta é um erro único, com
    contagem de ocorrências no período filtrado (não o total histórico
    absoluto, que fica em Ocorrencias na SharePoint List)."""
    if not _existe_algum_parquet():
        return {"itens": [], "aviso": "nenhum arquivo Parquet encontrado ainda"}

    con = conectar()
    _base_query(con)

    condicoes = []
    parametros = []
    if aplicacao:
        condicoes.append("app = ?")
        parametros.append(aplicacao)
    if categoria:
        condicoes.append("Categoria = ?")
        parametros.append(categoria)
    if criticidade:
        condicoes.append("Criticidade = ?")
        parametros.append(criticidade)
    # status e' filtrado depois de agrupar (ver abaixo) - StatusNoMomento por
    # OCORRENCIA nao reflete o status atual do item, so o status quando
    # aquela linha foi gravada.
    if data_inicio:
        condicoes.append("CAST(data AS DATE) >= ?")
        parametros.append(data_inicio)
    if data_fim:
        condicoes.append("CAST(data AS DATE) <= ?")
        parametros.append(data_fim)

    where = f"WHERE {' AND '.join(condicoes)}" if condicoes else ""

    sql = f"""
        SELECT
            CodErro,
            app AS Aplicacao,
            arg_max(Categoria, TimestampOcorrencia) AS Categoria,
            arg_max(TipoErro, TimestampOcorrencia) AS TipoErro,
            arg_max(Criticidade, TimestampOcorrencia) AS Criticidade,
            arg_max(StatusNoMomento, TimestampOcorrencia) AS UltimoStatusConhecido,
            COUNT(*) AS OcorrenciasNoPeriodo,
            MIN(TimestampOcorrencia) AS PrimeiraNoPeriodo,
            MAX(TimestampOcorrencia) AS UltimaNoPeriodo
        FROM erros
        {where}
        GROUP BY CodErro, app
        ORDER BY UltimaNoPeriodo DESC
    """
    try:
        resultado = con.execute(sql, parametros).fetchdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    itens = resultado.to_dict(orient="records")

    # Sobrescreve com o status AO VIVO da SharePoint List quando disponivel -
    # arg_max acima so resolve o bug de escolher valor arbitrario, mas ainda
    # e' o status na ULTIMA OCORRENCIA gravada no Parquet, que pode estar
    # desatualizado se o item foi aprovado/resolvido depois sem nova ocorrencia.
    status_vivo = _status_vivo_por_coderro()
    for item in itens:
        vivo = status_vivo.get(item["CodErro"])
        if vivo and vivo.get("Status"):
            item["UltimoStatusConhecido"] = vivo["Status"]
            item["StatusAoVivo"] = True
        else:
            item["StatusAoVivo"] = False

    if status:
        itens = [i for i in itens if i["UltimoStatusConhecido"] == status]

    return {"itens": itens}


@app.get("/api/erros/{cod_erro}/historico")
def historico_do_erro(cod_erro: str):
    """Todas as ocorrências brutas de um CodErro — o drill-down."""
    if not _existe_algum_parquet():
        raise HTTPException(status_code=404, detail="nenhum Parquet encontrado")

    con = conectar()
    _base_query(con)
    sql = """
        SELECT * FROM erros
        WHERE CodErro = ?
        ORDER BY TimestampOcorrencia DESC
    """
    resultado = con.execute(sql, [cod_erro]).fetchdf()
    if resultado.empty:
        raise HTTPException(status_code=404, detail=f"CodErro {cod_erro} não encontrado")
    return {"ocorrencias": resultado.to_dict(orient="records")}


@app.get("/api/tendencia")
def tendencia(
    aplicacao: Optional[str] = Query(None),
    dias: int = Query(30, ge=1, le=365),
):
    """Contagem de ocorrências por dia, por categoria — pro gráfico simples."""
    if not _existe_algum_parquet():
        return {"pontos": []}

    con = conectar()
    _base_query(con)

    condicoes = [f"CAST(data AS DATE) >= CURRENT_DATE - INTERVAL '{dias} days'"]
    parametros = []
    if aplicacao:
        condicoes.append("app = ?")
        parametros.append(aplicacao)
    where = f"WHERE {' AND '.join(condicoes)}"

    sql = f"""
        SELECT
            CAST(data AS DATE) AS dia,
            Categoria,
            COUNT(*) AS total
        FROM erros
        {where}
        GROUP BY dia, Categoria
        ORDER BY dia
    """
    resultado = con.execute(sql, parametros).fetchdf()
    return {"pontos": resultado.to_dict(orient="records")}


# --- Proxy pra API de tarefas agendadas (roda fora de container, ver acima) ---
# TODO(seguranca): gate de SSO antes de expor esse backend fora da rede
# interna da VM — hoje sem isso, qualquer requisicao aqui roda comando real
# no host (crontab, scripts) ou cria tarefa nova.

@app.get("/api/tarefas")
def listar_tarefas():
    try:
        resp = httpx.get(f"{TAREFAS_API_URL}/tarefas", timeout=15)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    return resp.json()


@app.post("/api/tarefas")
async def criar_tarefa(request: Request):
    corpo = await request.json()
    try:
        resp = httpx.post(f"{TAREFAS_API_URL}/tarefas", json=corpo, timeout=15)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json().get("detail"))
    return resp.json()


@app.post("/api/tarefas/{tarefa_id}/executar")
def executar_tarefa(tarefa_id: str):
    try:
        resp = httpx.post(f"{TAREFAS_API_URL}/tarefas/{tarefa_id}/executar", timeout=620)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json().get("detail"))
    return resp.json()


@app.patch("/api/tarefas/{tarefa_id}")
async def atualizar_tarefa(tarefa_id: str, request: Request):
    corpo = await request.json()
    try:
        resp = httpx.patch(f"{TAREFAS_API_URL}/tarefas/{tarefa_id}", json=corpo, timeout=15)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json().get("detail"))
    return resp.json()


@app.post("/api/tarefas/{tarefa_id}/analise-ia")
def analisar_com_ia(tarefa_id: str):
    try:
        resp = httpx.post(f"{TAREFAS_API_URL}/tarefas/{tarefa_id}/analise-ia", timeout=70)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json().get("detail"))
    return resp.json()


@app.get("/api/tarefas/{tarefa_id}/log")
def log_da_tarefa(tarefa_id: str, linhas: int = 200):
    try:
        resp = httpx.get(f"{TAREFAS_API_URL}/tarefas/{tarefa_id}/log", params={"linhas": linhas}, timeout=15)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json().get("detail"))
    return resp.json()


@app.get("/api/infra")
def infra():
    try:
        resp = httpx.get(f"{TAREFAS_API_URL}/infra", timeout=20)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    return resp.json()


@app.get("/api/custos")
def custos_claude():
    try:
        resp = httpx.get(f"{TAREFAS_API_URL}/custos", timeout=15)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"tarefas-api indisponivel: {exc}")
    return resp.json()
