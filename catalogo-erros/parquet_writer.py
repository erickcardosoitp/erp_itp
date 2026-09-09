"""Histórico analítico (spec seção 7): append-only, particionado por
app/data. Cada ocorrência vira uma linha, nunca alterada — diferente da
SharePoint List, que é o catálogo mutável.

Implementação: como Parquet não suporta append real dentro de um mesmo
arquivo, cada execução do coletor escreve um arquivo novo dentro da
partição do dia (padrão Hive: app=X/data=YYYY-MM-DD/part-<id>.parquet).
DuckDB/pyarrow leem o diretório inteiro como uma tabela lógica só.
"""
from __future__ import annotations  # PEP 604 (X | None) — VM roda Python 3.9

import os
import uuid
from datetime import datetime, timezone

import pyarrow as pa
import pyarrow.parquet as pq

SCHEMA = pa.schema([
    ("CodErro", pa.string()),
    ("Aplicacao", pa.string()),
    ("Categoria", pa.string()),
    ("TipoErro", pa.string()),
    ("MensagemNormalizada", pa.string()),
    ("Criticidade", pa.string()),
    ("StatusNoMomento", pa.string()),
    ("TimestampOcorrencia", pa.timestamp("us", tz="UTC")),
    ("FoiAutoCorrigido", pa.bool_()),
])


def gravar_lote(base_dir: str, linhas: list[dict]) -> str | None:
    """Recebe uma lista de dicts (uma por ocorrência) e grava um único
    arquivo Parquet novo. Assume que todas as linhas do lote são do mesmo
    dia/app — se não forem, particiona por grupo antes de chamar isso.
    Devolve o caminho do arquivo gravado, ou None se a lista veio vazia."""
    if not linhas:
        return None

    aplicacao = linhas[0]["Aplicacao"]
    data_str = linhas[0]["TimestampOcorrencia"].strftime("%Y-%m-%d")
    partition_dir = os.path.join(base_dir, f"app={aplicacao}", f"data={data_str}")
    os.makedirs(partition_dir, exist_ok=True)

    tabela = pa.Table.from_pylist(linhas, schema=SCHEMA)
    arquivo = os.path.join(partition_dir, f"part-{uuid.uuid4().hex[:12]}.parquet")
    pq.write_table(tabela, arquivo)
    return arquivo


def agrupar_e_gravar(base_dir: str, linhas: list[dict]) -> list[str]:
    """Agrupa por (Aplicacao, dia) antes de gravar, já que um lote do
    coletor pode ter erros de containers/apps diferentes no mesmo run."""
    grupos: dict[tuple, list[dict]] = {}
    for linha in linhas:
        chave = (linha["Aplicacao"], linha["TimestampOcorrencia"].strftime("%Y-%m-%d"))
        grupos.setdefault(chave, []).append(linha)

    arquivos = []
    for grupo in grupos.values():
        caminho = gravar_lote(base_dir, grupo)
        if caminho:
            arquivos.append(caminho)
    return arquivos


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)
