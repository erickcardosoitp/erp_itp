#!/usr/bin/env python3
"""Wrapper de execucao de tarefas agendadas - roda toda tarefa do crontab
gerenciada pelo ITP_TEC, medindo duracao real e exit code (em vez da
heuristica antiga de procurar palavra "erro" no log, que dava falso
positivo com JSON tipo {"error":null}).

Uso no crontab: tarefas_runner.py <id-da-tarefa>
Le comando/log_path do proprio tarefas-registro.json (fonte unica de
verdade), executa via bash -c, grava:
  - stdout+stderr no log_path da tarefa (preserva o que ja existia)
  - uma linha JSON em tarefas-timing/<id>.jsonl com inicio/fim/duracao/exit_code
"""
import json
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REGISTRO_PATH = Path.home() / "itp-stack" / "tarefas-registro.json"
TIMING_DIR = Path.home() / "itp-stack" / "tarefas-timing"
TIMING_DIR.mkdir(parents=True, exist_ok=True)
MAX_HISTORICO = 50  # mantem so as ultimas N execucoes por tarefa


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: tarefas_runner.py <id-da-tarefa>", file=sys.stderr)
        return 2

    task_id = sys.argv[1]
    registro = json.loads(REGISTRO_PATH.read_text(encoding="utf-8"))
    tarefa = next((t for t in registro.get("tarefas", []) if t["id"] == task_id), None)
    if not tarefa:
        print(f"tarefa {task_id} nao encontrada no registro", file=sys.stderr)
        return 2

    if tarefa["tipo"] == "script":
        comando = tarefa["caminho"]
    else:
        partes = ["curl", "-s", "-w", "\\nHTTP:%{http_code}\\n"]
        if tarefa.get("http_metodo") == "POST":
            partes += ["-X", "POST"]
        for chave, valor in (tarefa.get("http_headers") or {}).items():
            partes += ["-H", f"{chave}: {valor}"]
        partes.append(tarefa["caminho"])
        comando = " ".join(shlex.quote(p) for p in partes)

    log_path = tarefa.get("log_path")

    inicio = datetime.now(timezone.utc)
    t0 = time.time()
    if log_path:
        Path(log_path).parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as logf:
            logf.write(f"\n=== {inicio.isoformat()} — execucao via ITP_TEC ===\n")
            logf.flush()
            processo = subprocess.run(["bash", "-c", comando], stdout=logf, stderr=subprocess.STDOUT)
    else:
        processo = subprocess.run(["bash", "-c", comando], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    duracao_s = round(time.time() - t0, 2)
    fim = datetime.now(timezone.utc)

    registro_execucao = {
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "duracao_s": duracao_s,
        "exit_code": processo.returncode,
    }

    arquivo_timing = TIMING_DIR / f"{task_id}.jsonl"
    linhas = []
    if arquivo_timing.exists():
        linhas = arquivo_timing.read_text(encoding="utf-8").splitlines()
    linhas.append(json.dumps(registro_execucao))
    linhas = linhas[-MAX_HISTORICO:]
    arquivo_timing.write_text("\n".join(linhas) + "\n", encoding="utf-8")

    return processo.returncode


if __name__ == "__main__":
    sys.exit(main())
