"""Camada 1 do fingerprinting (spec seção 6): normalização determinística
via regex, sem custo de IA. Remove o que é sempre variável entre
ocorrências do mesmo erro, pra permitir comparação exata na Camada 2.

Princípio de segurança do design: normalizar de menos (deixar coisa
variável passar) é seguro — só gera um item duplicado a mais. Normalizar
de mais (mascarar algo que na verdade distingue dois erros diferentes) é
perigoso — funde bugs diferentes num só. Por isso as regras aqui são
conservadoras.
"""
import re
from datetime import datetime, timezone

_TIMESTAMP = re.compile(
    r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?\s*(UTC|Z|[+-]\d{2}:?\d{2})?"
)
_TIMESTAMP_CAPTURA = re.compile(
    r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?"
)
_PID = re.compile(r"\[\d+\]")
_UUID = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
# Números soltos (posição de caractere, IDs numéricos, PIDs sem colchete).
# Não mexe em números colados a letra (ex: "v23", "erp_itp_backend").
_NUMERO_SOLTO = re.compile(r"(?<![a-zA-Z_])\d+(?![a-zA-Z_])")
# Códigos de cor ANSI (comum em logs de app tipo Nest Logger). Sem isso,
# caracteres de controle (ESC etc.) quebram a query OData pro Graph API
# (achado em teste real, 2026-09-10: 400 Bad Request no $filter).
_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def normalizar(mensagem: str) -> str:
    """Aplica as substituições na ordem certa (timestamp/uuid antes de
    número solto, senão o regex de número já teria comido os dígitos)."""
    m = mensagem.strip()
    m = _ANSI.sub("", m)
    m = _TIMESTAMP.sub("<timestamp>", m)
    m = _UUID.sub("<uuid>", m)
    m = _PID.sub("[N]", m)
    m = _NUMERO_SOLTO.sub("N", m)
    m = re.sub(r"\s+", " ", m)  # colapsa espaços múltiplos (efeito colateral das trocas acima)
    return m.strip()


def contem_erro(linha: str, padrao) -> bool:
    return bool(re.search(padrao, linha, re.IGNORECASE))


def extrair_timestamp(linha: str):
    """Tenta achar um timestamp real na linha (formato Postgres/ISO, ex:
    '2026-09-09 11:27:07.759 UTC'). Devolve datetime UTC, ou None se a
    linha não tiver timestamp reconhecível (ex: log sem timestamp próprio,
    caso comum de app que deixa isso a cargo do driver do Docker)."""
    m = _TIMESTAMP_CAPTURA.search(linha)
    if not m:
        return None
    data_str, hora_str, frac = m.group(1), m.group(2), m.group(3) or ""
    try:
        dt = datetime.strptime(data_str + " " + hora_str, "%Y-%m-%d %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None
