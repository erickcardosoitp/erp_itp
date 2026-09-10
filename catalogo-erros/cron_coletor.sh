#!/usr/bin/env bash
# Wrapper de agendamento adaptativo do coletor de erros.
#
# Cron puro (crontab) só dispara em horário fixo — não tem como "rodar de
# novo em 1h se achou muito erro". Por isso, esse script roda de 1 em 1h
# (barato, é só ler um JSON pequeno) mas só EXECUTA o coletor de verdade
# quando a hora programada em catalogo-erros-cron-state.json chegar.
#
# Regra (2026-09-09, refinada em 2026-09-10): intervalo escalona pela
# CRITICIDADE do pior item novo encontrado, não só pela quantidade —
# erro crítico merece reação em minutos, erro banal pode esperar horas.
# O cron em si precisa tickar de 5 em 5 min (ver crontab) pra esse
# intervalo curto ser possível — a maioria dos ticks só lê o state file
# e sai sem custo, só executa o coletor de verdade quando chega a hora.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$HOME/itp-stack/catalogo-erros-cron-state.json"
LIMITE_MUITOS_ERROS=5
INTERVALO_NORMAL_H=6      # nenhum item novo, ou só criticidade baixa
INTERVALO_MEDIA_MIN=120   # pior item novo = criticidade media
INTERVALO_ALTA_MIN=30     # pior item novo = criticidade alta
INTERVALO_CRITICA_MIN=5   # pior item novo = criticidade critica

AGORA_EPOCH=$(date -u +%s)

if [ -f "$STATE_FILE" ]; then
  PROXIMA_EPOCH=$(python3 -c "import json; print(int(json.load(open('$STATE_FILE')).get('proxima_execucao_epoch', 0)))" 2>/dev/null || echo 0)
else
  PROXIMA_EPOCH=0
fi

if [ "$AGORA_EPOCH" -lt "$PROXIMA_EPOCH" ]; then
  exit 0  # ainda não é hora — saída silenciosa, sem gastar nada
fi

echo "=== $(date -u -Iseconds) - executando coletor ==="
SAIDA=$(python3 "$DIR/coletor.py" 2>&1)
echo "$SAIDA"

ITENS_NOVOS=$(echo "$SAIDA" | grep -c "item novo criado" || true)

# Escolhe pela pior (mais alta) criticidade vista entre os itens novos
# deste run — não importa se só 1 dos 5 itens novos é crítico, o
# intervalo curto vale pra todos até a próxima varredura.
if echo "$SAIDA" | grep -q "criticidade=critica"; then
  PROXIMO_INTERVALO_S=$((INTERVALO_CRITICA_MIN * 60))
  echo "AVISO: item CRÍTICO encontrado — próxima varredura em ${INTERVALO_CRITICA_MIN} min"
elif echo "$SAIDA" | grep -q "criticidade=alta"; then
  PROXIMO_INTERVALO_S=$((INTERVALO_ALTA_MIN * 60))
  echo "AVISO: item de criticidade ALTA encontrado — próxima varredura em ${INTERVALO_ALTA_MIN} min"
elif echo "$SAIDA" | grep -q "criticidade=media"; then
  PROXIMO_INTERVALO_S=$((INTERVALO_MEDIA_MIN * 60))
  echo "Item de criticidade média encontrado — próxima varredura em ${INTERVALO_MEDIA_MIN} min"
elif [ "$ITENS_NOVOS" -gt "$LIMITE_MUITOS_ERROS" ]; then
  PROXIMO_INTERVALO_S=$((INTERVALO_ALTA_MIN * 60))
  echo "AVISO: $ITENS_NOVOS itens novos (> $LIMITE_MUITOS_ERROS), mesmo que baixa criticidade — próxima varredura em ${INTERVALO_ALTA_MIN} min"
else
  PROXIMO_INTERVALO_S=$((INTERVALO_NORMAL_H * 3600))
fi

PROXIMA_NOVA_EPOCH=$((AGORA_EPOCH + PROXIMO_INTERVALO_S))
python3 -c "
import json
json.dump({'proxima_execucao_epoch': $PROXIMA_NOVA_EPOCH, 'ultima_execucao_epoch': $AGORA_EPOCH, 'ultimos_itens_novos': $ITENS_NOVOS}, open('$STATE_FILE', 'w'), indent=2)
"
echo "Próxima varredura agendada para: $(date -u -d "@$PROXIMA_NOVA_EPOCH" -Iseconds)"
