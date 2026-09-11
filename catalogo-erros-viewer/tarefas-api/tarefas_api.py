#!/usr/bin/env python3
"""API interna de gestão de tarefas agendadas (crontab) do vm-itp-prod.

Roda direto no host (nao em container) como usuario itpadmin, via systemd
- e' o unico jeito limpo de manipular o crontab real do usuario sem hack
de permissao/UID dentro de container Docker. So escuta em 127.0.0.1;
quem expoe pra fora (com auth) e' o catalogo_backend/frontend, via proxy.

Sem autenticacao aqui de proposito - a fronteira de seguranca fica no
proxy (catalogo_backend), que so deve chamar isso depois do SSO validar
a sessao. Nunca bind em 0.0.0.0.
"""
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from croniter import croniter
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

REGISTRO_PATH = Path.home() / "itp-stack" / "tarefas-registro.json"
SCRIPTS_DIR = Path.home() / "itp-stack" / "tarefas"
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
TIMING_DIR = Path.home() / "itp-stack" / "tarefas-timing"
TIMING_DIR.mkdir(parents=True, exist_ok=True)
ANALISE_IA_DIR = Path.home() / "itp-stack" / "tarefas-analise-ia"
ANALISE_IA_DIR.mkdir(parents=True, exist_ok=True)
RUNNER_PATH = "/opt/itp-stack/tarefas_runner.py"
RUNNER_PYTHON = "/opt/itp-stack/tarefas-venv/bin/python3"

app = FastAPI(title="ITP_TEC - Tarefas Agendadas (interno)")

PERMISSOES = ["tec", "admin"]  # ordem crescente de privilegio
CRON_ID_RE = re.compile(r"^[a-z0-9-]+$")


def _carregar_registro() -> dict:
    if not REGISTRO_PATH.exists():
        return {"tarefas": []}
    return json.loads(REGISTRO_PATH.read_text(encoding="utf-8"))


def _salvar_registro(registro: dict) -> None:
    REGISTRO_PATH.write_text(json.dumps(registro, indent=2, ensure_ascii=False), encoding="utf-8")


def _crontab_atual() -> str:
    resultado = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    return resultado.stdout if resultado.returncode == 0 else ""


def _tail(log_path: Optional[str], max_bytes: int = 4000) -> list[str]:
    if not log_path or not os.path.exists(log_path):
        return []
    try:
        with open(log_path, "rb") as f:
            f.seek(0, os.SEEK_END)
            tamanho = f.tell()
            f.seek(max(0, tamanho - max_bytes))
            cauda = f.read().decode("utf-8", errors="ignore")
        return [l for l in cauda.splitlines() if l.strip()]
    except OSError:
        return []


def _historico_timing(tarefa_id: str) -> list[dict]:
    """Historico estruturado (exit_code real, nao heuristica de palavra)
    gravado pelo tarefas_runner.py a cada execucao via crontab/manual."""
    arquivo = TIMING_DIR / f"{tarefa_id}.jsonl"
    if not arquivo.exists():
        return []
    registros = []
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha:
            continue
        try:
            registros.append(json.loads(linha))
        except json.JSONDecodeError:
            continue
    return registros


def _status_execucao(tarefa_id: str) -> dict:
    historico = _historico_timing(tarefa_id)
    if not historico:
        return {
            "status": "nunca_rodou", "ultima_execucao": None, "duracao_s": None,
            "duracao_media_s": None, "exit_code": None,
        }
    ultimo = historico[-1]
    duracoes = [h["duracao_s"] for h in historico if h.get("duracao_s") is not None]
    return {
        "status": "ok" if ultimo.get("exit_code") == 0 else "erro",
        "ultima_execucao": ultimo.get("fim") or ultimo.get("inicio"),
        "duracao_s": ultimo.get("duracao_s"),
        "duracao_media_s": round(sum(duracoes) / len(duracoes), 2) if duracoes else None,
        "exit_code": ultimo.get("exit_code"),
    }


def _proxima_execucao(schedule: str) -> Optional[str]:
    try:
        agora = datetime.now(timezone.utc)
        it = croniter(schedule, agora)
        return it.get_next(datetime).isoformat()
    except (ValueError, KeyError):
        return None


@app.get("/tarefas")
def listar_tarefas():
    registro = _carregar_registro()
    crontab_texto = _crontab_atual()
    tarefas = []
    for t in registro.get("tarefas", []):
        no_crontab = t["id"] in crontab_texto
        tarefas.append({
            **t,
            "presente_no_crontab": no_crontab,
            "proxima_execucao": _proxima_execucao(t.get("schedule", "")),
            **{f"ultima_execucao_{k}": v for k, v in _status_execucao(t["id"]).items()},
        })
    return {"tarefas": tarefas}


@app.get("/tarefas/{tarefa_id}/log")
def log_da_tarefa(tarefa_id: str, linhas: int = 200):
    registro = _carregar_registro()
    tarefa = next((t for t in registro.get("tarefas", []) if t["id"] == tarefa_id), None)
    if not tarefa:
        raise HTTPException(404, "tarefa nao encontrada")
    texto = _tail(tarefa.get("log_path"), max_bytes=60_000)
    return {"tarefa_id": tarefa_id, "log_path": tarefa.get("log_path"), "linhas": texto[-linhas:]}


class NovaTarefa(BaseModel):
    id: str
    nome: str
    aplicacao: str
    tipo: str  # "script" ou "http"
    schedule: str  # expressao cron, ex: "0 */6 * * *"
    intervalo_legivel: str
    criticidade: str  # baixa|media|alta|critica
    descricao: str
    criador: str
    permissao_minima: str  # tec|admin
    executavel_manualmente: bool = True
    # Um dos dois, dependendo do tipo:
    conteudo_script: Optional[str] = None  # texto do bash, se tipo=script
    endpoint_http: Optional[str] = None    # URL, se tipo=http
    http_metodo: str = "GET"               # GET|POST, so usado se tipo=http
    http_headers: Optional[dict] = None    # ex: {"x-cron-secret": "..."}


@app.post("/tarefas")
def criar_tarefa(nova: NovaTarefa):
    if not CRON_ID_RE.match(nova.id):
        raise HTTPException(400, "id deve ser slug: letras minusculas, numeros, hifen")
    if nova.permissao_minima not in PERMISSOES:
        raise HTTPException(400, f"permissao_minima deve ser uma de {PERMISSOES}")
    if nova.criticidade not in ("baixa", "media", "alta", "critica"):
        raise HTTPException(400, "criticidade invalida")

    registro = _carregar_registro()
    if any(t["id"] == nova.id for t in registro.get("tarefas", [])):
        raise HTTPException(409, f"ja existe tarefa com id {nova.id}")

    if nova.tipo == "script":
        if not nova.conteudo_script:
            raise HTTPException(400, "conteudo_script obrigatorio para tipo=script")
        caminho_script = SCRIPTS_DIR / f"{nova.id}.sh"
        caminho_script.write_text(nova.conteudo_script, encoding="utf-8")
        caminho_script.chmod(0o750)
        comando = str(caminho_script)
    elif nova.tipo == "http":
        if not nova.endpoint_http:
            raise HTTPException(400, "endpoint_http obrigatorio para tipo=http")
        comando = nova.endpoint_http
    else:
        raise HTTPException(400, "tipo deve ser 'script' ou 'http'")

    log_path = str(SCRIPTS_DIR / "logs" / f"{nova.id}.log")
    # Sempre roda via runner - mede duracao/exit_code de verdade, em vez de
    # cada tarefa escrever seu proprio redirecionamento (>>log 2>&1), o que
    # impedia medir tempo real e misturava logs de tarefas diferentes no
    # mesmo arquivo compartilhado (achado real, 2026-09-11).
    linha_crontab = f"{nova.schedule} {RUNNER_PYTHON} {RUNNER_PATH} {nova.id}"

    crontab_texto = _crontab_atual()
    novo_crontab = crontab_texto.rstrip("\n") + "\n" + linha_crontab + "\n"
    processo = subprocess.run(["crontab", "-"], input=novo_crontab, text=True, capture_output=True)
    if processo.returncode != 0:
        raise HTTPException(500, f"falha ao gravar crontab: {processo.stderr}")

    entrada = {
        "id": nova.id,
        "nome": nova.nome,
        "aplicacao": nova.aplicacao,
        "tipo": nova.tipo,
        "caminho": comando,
        "schedule": nova.schedule,
        "intervalo_legivel": nova.intervalo_legivel,
        "criador": nova.criador,
        "criado_em": datetime.now(timezone.utc).date().isoformat(),
        "criticidade": nova.criticidade,
        "descricao": nova.descricao,
        "executavel_manualmente": nova.executavel_manualmente,
        "permissao_minima": nova.permissao_minima,
        "log_path": log_path,
        "http_metodo": nova.http_metodo if nova.tipo == "http" else None,
        "http_headers": nova.http_headers if nova.tipo == "http" else None,
    }
    registro.setdefault("tarefas", []).append(entrada)
    _salvar_registro(registro)
    return {"ok": True, "tarefa": entrada}


@app.post("/tarefas/{tarefa_id}/executar")
def executar_tarefa(tarefa_id: str):
    registro = _carregar_registro()
    tarefa = next((t for t in registro.get("tarefas", []) if t["id"] == tarefa_id), None)
    if not tarefa:
        raise HTTPException(404, "tarefa nao encontrada")
    if not tarefa.get("executavel_manualmente"):
        raise HTTPException(403, "tarefa marcada como nao executavel manualmente")

    # Roda pelo mesmo runner do crontab, pra manual e agendado terem timing
    # e log gravados de forma identica/comparavel.
    resultado = subprocess.run(
        [RUNNER_PYTHON, RUNNER_PATH, tarefa_id],
        capture_output=True, text=True, timeout=610,
    )
    return {
        "ok": resultado.returncode == 0,
        "returncode": resultado.returncode,
        "stdout": _tail(tarefa.get("log_path"), max_bytes=4000),
        "stderr": resultado.stderr[-2000:],
        "executado_em": datetime.now(timezone.utc).isoformat(),
    }


class AtualizarTarefa(BaseModel):
    criticidade: Optional[str] = None
    executavel_manualmente: Optional[bool] = None
    permissao_minima: Optional[str] = None


@app.patch("/tarefas/{tarefa_id}")
def atualizar_tarefa(tarefa_id: str, mudancas: AtualizarTarefa):
    registro = _carregar_registro()
    tarefa = next((t for t in registro.get("tarefas", []) if t["id"] == tarefa_id), None)
    if not tarefa:
        raise HTTPException(404, "tarefa nao encontrada")

    if mudancas.criticidade is not None:
        if mudancas.criticidade not in ("baixa", "media", "alta", "critica"):
            raise HTTPException(400, "criticidade invalida")
        tarefa["criticidade"] = mudancas.criticidade
    if mudancas.executavel_manualmente is not None:
        tarefa["executavel_manualmente"] = mudancas.executavel_manualmente
    if mudancas.permissao_minima is not None:
        if mudancas.permissao_minima not in PERMISSOES:
            raise HTTPException(400, f"permissao_minima deve ser uma de {PERMISSOES}")
        tarefa["permissao_minima"] = mudancas.permissao_minima

    _salvar_registro(registro)
    return {"ok": True, "tarefa": tarefa}


@app.post("/tarefas/{tarefa_id}/analise-ia")
def analisar_com_ia(tarefa_id: str):
    """Resumo de 1 frase do que aconteceu na ultima execucao, via Claude
    Code CLI. Sob demanda (nao automatico pra toda tarefa a cada load da
    pagina) e cacheado por timestamp da ultima execucao - so gasta de novo
    quando a tarefa rodou de novo desde a ultima analise."""
    registro = _carregar_registro()
    tarefa = next((t for t in registro.get("tarefas", []) if t["id"] == tarefa_id), None)
    if not tarefa:
        raise HTTPException(404, "tarefa nao encontrada")

    status = _status_execucao(tarefa_id)
    ultima_execucao = status.get("ultima_execucao")
    if not ultima_execucao:
        return {"analise": "Tarefa nunca rodou — nada para analisar."}

    cache_path = ANALISE_IA_DIR / f"{tarefa_id}.json"
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
        if cache.get("ultima_execucao") == ultima_execucao:
            return {"analise": cache["analise"], "cache": True}

    log_tail = "\n".join(_tail(tarefa.get("log_path"), max_bytes=6000))
    prompt = (
        f"Resuma em 1 frase curta (max 25 palavras), em portugues simples, "
        f"o que aconteceu na ultima execucao da tarefa '{tarefa['nome']}' "
        f"(exit_code={status.get('exit_code')}) a partir do log abaixo. "
        f"Se nao houver log suficiente, diga isso.\n\nLOG:\n{log_tail[-4000:]}"
    )
    try:
        resultado = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json"],
            capture_output=True, text=True, timeout=60,
        )
        envelope = json.loads(resultado.stdout)
        analise = envelope.get("result", "").strip()
    except Exception as exc:
        raise HTTPException(502, f"falha ao chamar Claude CLI: {exc}")

    cache_path.write_text(
        json.dumps({"ultima_execucao": ultima_execucao, "analise": analise}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"analise": analise, "cache": False}


CUSTOS_JSONL = Path.home() / "itp-stack" / "catalogo-erros-custos.jsonl"
CATALOGO_LOGS = [
    Path.home() / "itp-stack" / "catalogo-erros-cron.log",
    Path.home() / "itp-stack" / "catalogo-erros-aplicador.log",
]
_PADRAO_CUSTO = re.compile(
    r"^\[(\d{4}-\d{2}-\d{2})T[^\]]*\].*?\$(\d+\.\d+)", re.IGNORECASE
)


def _custos_estruturados() -> list[dict]:
    """Fonte primaria (2026-09-11 em diante): coletor.py/aplicador.py
    gravam um evento estruturado por chamada ao Claude (custos.py)."""
    if not CUSTOS_JSONL.exists():
        return []
    eventos = []
    for linha in CUSTOS_JSONL.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha:
            continue
        try:
            e = json.loads(linha)
            eventos.append({
                "dia": e["timestamp"][:10],
                "valor_usd": e["valor_usd"],
                "linha": f"[{e['origem']}] {e.get('cod_erro') or ''} ${e['valor_usd']:.4f}".strip(),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return eventos


def _custos_legado_por_log() -> list[dict]:
    """Fallback pra eventos anteriores a 2026-09-11 (so existiam em texto
    de log, sem persistencia estruturada) - garante que o historico nao
    some so porque o formato mudou."""
    eventos = []
    for log_path in CATALOGO_LOGS:
        if not log_path.exists():
            continue
        try:
            texto = log_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for linha in texto.splitlines():
            if "custo" not in linha.lower():
                continue
            m = _PADRAO_CUSTO.match(linha)
            if not m:
                continue
            eventos.append({"dia": m.group(1), "valor_usd": float(m.group(2)), "linha": linha.strip()[:200]})
    return eventos


@app.get("/custos")
def custos_claude():
    estruturados = _custos_estruturados()
    # So usa o fallback de log pra dias que o JSONL ainda nao cobre -
    # evita contar em dobro o mesmo evento nos dois formatos.
    dias_cobertos = {e["dia"] for e in estruturados}
    legado = [e for e in _custos_legado_por_log() if e["dia"] not in dias_cobertos]
    eventos = estruturados + legado

    por_dia: dict[str, float] = {}
    for e in eventos:
        por_dia[e["dia"]] = por_dia.get(e["dia"], 0.0) + e["valor_usd"]

    eventos.sort(key=lambda e: e["dia"], reverse=True)
    return {
        "total_usd": round(sum(por_dia.values()), 4),
        "por_dia": [{"dia": d, "total_usd": round(v, 4)} for d, v in sorted(por_dia.items(), reverse=True)],
        "eventos_recentes": eventos[:50],
    }


def _shell(comando: list[str], timeout: int = 10) -> str:
    try:
        r = subprocess.run(comando, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except (subprocess.TimeoutExpired, OSError):
        return ""


def _cpu_ram() -> dict:
    # /proc/loadavg: 1min 5min 15min - mais confiavel que "top" pra scriptar
    loadavg = _shell(["cat", "/proc/loadavg"]).split()
    mem = _shell(["free", "-m"]).splitlines()
    mem_vals = mem[1].split() if len(mem) > 1 else []
    # free -m linha "Mem:": total used free shared buff/cache available
    total_mb = int(mem_vals[1]) if len(mem_vals) > 1 else None
    disponivel_mb = int(mem_vals[6]) if len(mem_vals) > 6 else None
    return {
        "load_1min": float(loadavg[0]) if loadavg else None,
        "load_5min": float(loadavg[1]) if len(loadavg) > 1 else None,
        "load_15min": float(loadavg[2]) if len(loadavg) > 2 else None,
        "ram_total_mb": total_mb,
        "ram_disponivel_mb": disponivel_mb,
        "ram_uso_pct": round((1 - disponivel_mb / total_mb) * 100, 1) if total_mb and disponivel_mb else None,
    }


def _disco() -> dict:
    saida = _shell(["df", "-BM", "/"]).splitlines()
    if len(saida) < 2:
        return {}
    campos = saida[1].split()
    return {
        "total_mb": int(campos[1].rstrip("M")),
        "usado_mb": int(campos[2].rstrip("M")),
        "disponivel_mb": int(campos[3].rstrip("M")),
        "uso_pct": int(campos[4].rstrip("%")),
    }


def _containers() -> list[dict]:
    saida = _shell(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Status}}|{{.Image}}"])
    containers = []
    for linha in saida.splitlines():
        partes = linha.split("|")
        if len(partes) != 3:
            continue
        nome, status, imagem = partes
        containers.append({"nome": nome, "status": status, "imagem": imagem, "rodando": status.startswith("Up")})
    return containers


def _psql(sql: str) -> list[list[str]]:
    """Roda SQL no Postgres via docker exec, devolve linhas separadas por
    campo (psql -t -A -F, formato tabular simples pra parsear sem driver)."""
    saida = _shell([
        "docker", "exec", "itp_postgres", "psql", "-U", "itp_admin", "-d", "erp_itp_db",
        "-t", "-A", "-F", "|", "-c", sql,
    ], timeout=15)
    return [l.split("|") for l in saida.splitlines() if l.strip()]


def _postgres_stats() -> dict:
    conexoes = _psql("SELECT state, count(*) FROM pg_stat_activity GROUP BY state;")
    tamanho = _psql("SELECT pg_size_pretty(pg_database_size('erp_itp_db'));")
    maior_tabelas = _psql(
        "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)), n_live_tup "
        "FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
    )
    query_mais_antiga = _psql(
        "SELECT COALESCE(EXTRACT(EPOCH FROM (now() - query_start))::int, 0), state, "
        "left(query, 80) FROM pg_stat_activity "
        "WHERE state != 'idle' AND pid != pg_backend_pid() "
        "ORDER BY query_start ASC LIMIT 1;"
    )
    schemas = _psql(
        "SELECT schema_name FROM information_schema.schemata "
        "WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY 1;"
    )
    return {
        "conexoes_por_estado": {c[0] or "(sem estado)": int(c[1]) for c in conexoes if len(c) == 2},
        "tamanho_banco": tamanho[0][0] if tamanho else None,
        "maiores_tabelas": [
            {"tabela": r[0], "tamanho": r[1], "linhas_estimadas": int(r[2])}
            for r in maior_tabelas if len(r) == 3
        ],
        "query_mais_antiga_ativa": (
            {"duracao_s": int(query_mais_antiga[0][0]), "estado": query_mais_antiga[0][1], "query": query_mais_antiga[0][2]}
            if query_mais_antiga and len(query_mais_antiga[0]) == 3 else None
        ),
        "schemas": [s[0] for s in schemas],
    }


def _docker_stats() -> list[dict]:
    """CPU/mem por container - docker stats --no-stream (uma leitura, nao
    o modo live)."""
    saida = _shell([
        "docker", "stats", "--no-stream", "--format",
        "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}",
    ], timeout=15)
    resultado = []
    for linha in saida.splitlines():
        partes = linha.split("|")
        if len(partes) == 4:
            resultado.append({"nome": partes[0], "cpu_pct": partes[1], "mem_uso": partes[2], "mem_pct": partes[3]})
    return resultado


def _top_processos(n: int = 5) -> list[dict]:
    saida = _shell(["ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%cpu"])
    linhas = saida.splitlines()[1 : n + 1] if saida else []
    resultado = []
    for l in linhas:
        campos = l.split(None, 3)
        if len(campos) == 4:
            resultado.append({"pid": campos[0], "comando": campos[1], "cpu_pct": campos[2], "mem_pct": campos[3]})
    return resultado


def _rede() -> dict:
    conexoes_estabelecidas = _shell(["bash", "-c", "ss -tan state established | tail -n +2 | wc -l"])
    portas_ouvindo = _shell(["bash", "-c", "ss -tlnp 2>/dev/null | tail -n +2 | awk '{print $4}'"]).splitlines()
    return {
        "conexoes_estabelecidas": int(conexoes_estabelecidas) if conexoes_estabelecidas.isdigit() else None,
        "portas_ouvindo": portas_ouvindo,
    }


def _uptime_swap() -> dict:
    uptime = _shell(["bash", "-c", "uptime -p"])
    mem = _shell(["free", "-m"]).splitlines()
    swap_vals = mem[2].split() if len(mem) > 2 else []
    return {
        "uptime": uptime,
        "swap_total_mb": int(swap_vals[1]) if len(swap_vals) > 1 else None,
        "swap_usado_mb": int(swap_vals[2]) if len(swap_vals) > 2 else None,
    }


ENDPOINTS_CRITICOS = [
    {"nome": "Frontend ITP", "url": "https://itp.institutotiapretinha.org", "esperado": (200, 399)},
    {"nome": "Backend ITP (raiz)", "url": "https://api.itp.institutotiapretinha.org/api", "esperado": (200, 200)},
    {"nome": "SSO Microsoft", "url": "https://api.itp.institutotiapretinha.org/api/auth/microsoft", "esperado": (200, 399)},
    {"nome": "ITP_TEC (local)", "url": "http://localhost:8080", "esperado": (200, 200)},
]
# Achado real (2026-09-11): /health e /api/sistema/monitoramento-ti NAO
# servem pra check anonimo - primeiro nao existe (404), segundo exige
# sessao autenticada (401 sempre, mesmo saudavel). /api sozinho e' a
# rota raiz publica que reflete se o Nest subiu.


def _checar_endpoints() -> list[dict]:
    resultado = []
    for ep in ENDPOINTS_CRITICOS:
        saida = _shell([
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}|%{time_total}",
            "--max-time", "8", ep["url"],
        ], timeout=10)
        partes = saida.split("|")
        status = int(partes[0]) if partes and partes[0].isdigit() else None
        tempo_s = float(partes[1]) if len(partes) > 1 else None
        minimo, maximo = ep["esperado"]
        resultado.append({
            "nome": ep["nome"], "url": ep["url"],
            "status_code": status, "tempo_s": tempo_s,
            "ok": status is not None and minimo <= status <= maximo,
        })
    return resultado


@app.get("/infra")
def infra():
    return {
        "cpu_ram": _cpu_ram(),
        "disco": _disco(),
        "uptime_swap": _uptime_swap(),
        "rede": _rede(),
        "top_processos": _top_processos(),
        "containers": _containers(),
        "containers_stats": _docker_stats(),
        "postgres": _postgres_stats(),
        "endpoints_criticos": _checar_endpoints(),
        "coletado_em": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/healthz")
def healthz():
    return {"ok": True}
