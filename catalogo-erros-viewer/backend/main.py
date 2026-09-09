"""API de consulta do histórico de erros (Parquet) — só leitura.

Não substitui a SharePoint List (catálogo operacional editável, onde a
aprovação/resolução acontece). Essa API é a camada analítica descrita em
CATALOGO-ERROS.md seção 8: navegar o histórico, filtrar, ver tendência.

Usa DuckDB embutido lendo o diretório de Parquet direto (sem servidor de
banco) — mesmo motor recomendado no spec original.
"""
import os
from datetime import date
from typing import Optional

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

PARQUET_BASE_DIR = os.environ.get(
    "PARQUET_BASE_DIR", os.path.expanduser("~/itp-stack/catalogo-erros-parquet")
)
# Padrão Hive: app=X/data=Y/*.parquet — hive_partitioning reconstrói as
# colunas Aplicacao/data a partir do caminho automaticamente.
GLOB_PARQUET = os.path.join(PARQUET_BASE_DIR, "**", "*.parquet")

app = FastAPI(title="Catálogo de Erros — Visualização")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # app interna, sem dado sensível de credencial — ok pra v1
    allow_methods=["GET"],
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
    if status:
        condicoes.append("StatusNoMomento = ?")
        parametros.append(status)
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
            any_value(Categoria) AS Categoria,
            any_value(TipoErro) AS TipoErro,
            any_value(Criticidade) AS Criticidade,
            any_value(StatusNoMomento) AS UltimoStatusConhecido,
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

    return {"itens": resultado.to_dict(orient="records")}


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
