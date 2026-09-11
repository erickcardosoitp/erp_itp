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


def _ultima_execucao(log_path: Optional[str]) -> Optional[str]:
    """Le a ultima linha com timestamp reconhecivel do log da tarefa."""
    if not log_path or not os.path.exists(log_path):
        return None
    try:
        with open(log_path, "rb") as f:
            f.seek(0, os.SEEK_END)
            tamanho = f.tell()
            f.seek(max(0, tamanho - 4000))
            cauda = f.read().decode("utf-8", errors="ignore")
        linhas = [l for l in cauda.splitlines() if l.strip()]
        return linhas[-1][:200] if linhas else None
    except OSError:
        return None


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
            "ultima_execucao_log": _ultima_execucao(t.get("log_path")),
        })
    return {"tarefas": tarefas}


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


@app.get("/healthz")
def healthz():
    return {"ok": True}
