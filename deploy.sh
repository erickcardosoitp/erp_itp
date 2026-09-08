#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/erp_itp"
STACK_DIR="$HOME/itp-stack"

echo "==> Atualizando código-fonte"
cd "$REPO_DIR"
git pull origin main

echo "==> Build + subida dos containers"
cd "$STACK_DIR"
docker compose build
docker compose up -d

echo "==> Limpeza de build cache (mantém cache das últimas 24h)"
docker builder prune -f --filter "until=24h"
docker image prune -f

echo "==> Deploy concluído"
df -h /
