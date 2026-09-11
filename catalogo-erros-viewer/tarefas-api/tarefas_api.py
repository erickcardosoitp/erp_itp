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

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

REGISTRO_PATH = Path.home() / "itp-stack" / "tarefas-registro.json"
SCRIPTS_DIR = Path.home() / "itp-stack" / "tarefas"
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

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


_PADRAO_TIMESTAMP_LINHA = re.compile(r"^\[?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})")
_PALAVRAS_ERRO = re.compile(r"\b(erro|error|fatal|exception|traceback|falhou|failed)\b", re.IGNORECASE)


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


def _status_execucao(log_path: Optional[str]) -> dict:
    """Classifica a ultima execucao pelo log: ok/atencao/nunca_rodou.
    Heuristica (nao ha marcador estruturado de sucesso pra todo script) -
    procura palavra de erro nas ultimas linhas relevantes."""
    linhas = _tail(log_path)
    if not linhas:
        return {"status": "nunca_rodou", "ultimo_timestamp": None, "resumo": None}

    # Acha o inicio do bloco da execucao mais recente (ultima linha com
    # timestamp reconhecivel), pra nao julgar por uma execucao antiga.
    bloco = linhas
    for i in range(len(linhas) - 1, -1, -1):
        if _PADRAO_TIMESTAMP_LINHA.match(linhas[i]):
            bloco = linhas[i:]
            break

    texto_bloco = "\n".join(bloco)
    status = "erro" if _PALAVRAS_ERRO.search(texto_bloco) else "ok"
    m = _PADRAO_TIMESTAMP_LINHA.match(bloco[0]) if bloco else None
    return {
        "status": status,
        "ultimo_timestamp": m.group(1) if m else None,
        "resumo": bloco[-1][:200] if bloco else None,
    }


@app.get("/tarefas")
def listar_tarefas():
    registro = _carregar_registro()
    crontab_texto = _crontab_atual()
    tarefas = []
    for t in registro.get("tarefas", []):
        no_crontab = t.get("schedule", "") in crontab_texto and (
            t.get("caminho", "").split(" ")[0] in crontab_texto
            or t.get("caminho", "") in crontab_texto
        )
        tarefas.append({
            **t,
            "presente_no_crontab": no_crontab,
            **{f"ultima_execucao_{k}": v for k, v in _status_execucao(t.get("log_path")).items()},
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
        log_path = str(SCRIPTS_DIR / f"{nova.id}.log")
        linha_crontab = f"{nova.schedule} {comando} >> {log_path} 2>&1"
    elif nova.tipo == "http":
        if not nova.endpoint_http:
            raise HTTPException(400, "endpoint_http obrigatorio para tipo=http")
        comando = nova.endpoint_http
        log_path = str(Path.home() / "cron.log")
        linha_crontab = f'{nova.schedule} curl -s "{nova.endpoint_http}" >> {log_path} 2>&1'
    else:
        raise HTTPException(400, "tipo deve ser 'script' ou 'http'")

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

    if tarefa["tipo"] == "script":
        resultado = subprocess.run(
            ["bash", tarefa["caminho"]], capture_output=True, text=True, timeout=600
        )
    elif tarefa["tipo"] == "http":
        resultado = subprocess.run(
            ["curl", "-s", "-w", "\\nHTTP:%{http_code}", tarefa["caminho"]],
            capture_output=True, text=True, timeout=120,
        )
    else:
        raise HTTPException(400, "tipo de tarefa desconhecido")

    return {
        "ok": resultado.returncode == 0,
        "returncode": resultado.returncode,
        "stdout": resultado.stdout[-4000:],
        "stderr": resultado.stderr[-2000:],
        "executado_em": datetime.now(timezone.utc).isoformat(),
    }


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
