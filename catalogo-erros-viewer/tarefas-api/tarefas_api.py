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


CATALOGO_LOGS = [
    Path.home() / "itp-stack" / "catalogo-erros-cron.log",
    Path.home() / "itp-stack" / "catalogo-erros-aplicador.log",
]
_PADRAO_CUSTO = re.compile(
    r"^\[(\d{4}-\d{2}-\d{2})T[^\]]*\].*?\$(\d+\.\d+)", re.IGNORECASE
)


@app.get("/custos")
def custos_claude():
    """Agrega o \\$custo_usd que coletor.py/aplicador.py ja logam em texto -
    nao existe (ainda) persistencia estruturada, so o log bruto. Ver
    pendencia registrada no spec (2026-09-11): persistir isso de verdade
    no Parquet/SharePoint e o caminho certo pra frente, isso aqui e' um
    jeito rapido de dar visibilidade sem esperar por aquilo."""
    por_dia: dict[str, float] = {}
    eventos: list[dict] = []
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
            dia, valor_str = m.group(1), m.group(2)
            valor = float(valor_str)
            por_dia[dia] = por_dia.get(dia, 0.0) + valor
            eventos.append({"dia": dia, "valor_usd": valor, "linha": linha.strip()[:200]})

    eventos.sort(key=lambda e: e["dia"], reverse=True)
    return {
        "total_usd": round(sum(por_dia.values()), 4),
        "por_dia": [{"dia": d, "total_usd": round(v, 4)} for d, v in sorted(por_dia.items(), reverse=True)],
        "eventos_recentes": eventos[:50],
    }


@app.get("/healthz")
def healthz():
    return {"ok": True}
