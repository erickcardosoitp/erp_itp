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

echo "==> Limpeza de build cache (mantém no máx. 5GB)"
docker builder prune -f --keep-storage 5GB
docker image prune -f

echo "==> Deploy concluído"
df -h /
