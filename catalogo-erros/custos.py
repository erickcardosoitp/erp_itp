"""Persistência estruturada do custo de chamadas ao Claude Code CLI —
antes só existia em texto de log (grep frágil). Um evento por chamada,
JSONL append-only, mesmo padrão do Parquet (nunca reescreve, só adiciona).
"""
import json
import os
from datetime import datetime, timezone

CUSTOS_PATH = os.path.expanduser("~/itp-stack/catalogo-erros-custos.jsonl")


def registrar(origem: str, valor_usd: float, cod_erro: str | None = None) -> None:
    if not valor_usd:
        return
    evento = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "origem": origem,  # "coletor" ou "aplicador"
        "valor_usd": round(valor_usd, 6),
        "cod_erro": cod_erro,
    }
    os.makedirs(os.path.dirname(CUSTOS_PATH), exist_ok=True)
    with open(CUSTOS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(evento, ensure_ascii=False) + "\n")
