#!/usr/bin/env bash
# Wrapper de agendamento adaptativo do coletor de erros.
#
# Cron puro (crontab) só dispara em horário fixo — não tem como "rodar de
# novo em 1h se achou muito erro". Por isso, esse script roda de 1 em 1h
# (barato, é só ler um JSON pequeno) mas só EXECUTA o coletor de verdade
# quando a hora programada em catalogo-erros-cron-state.json chegar.
#
# Regra (pedida pelo usuário 2026-09-09): normalmente 6h em 6h; se o
# último run encontrou muitos itens novos (> LIMITE_MUITOS_ERROS), reduz
# o intervalo pra 1h (assumindo que pode ser um incidente em andamento);
# senão, volta pro intervalo normal de 6h.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$HOME/itp-stack/catalogo-erros-cron-state.json"
LIMITE_MUITOS_ERROS=5
INTERVALO_NORMAL_H=6
INTERVALO_CURTO_H=1

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

if [ "$ITENS_NOVOS" -gt "$LIMITE_MUITOS_ERROS" ]; then
  PROXIMO_INTERVALO_S=$((INTERVALO_CURTO_H * 3600))
  echo "AVISO: $ITENS_NOVOS itens novos (> $LIMITE_MUITOS_ERROS) — próxima varredura em ${INTERVALO_CURTO_H}h em vez de ${INTERVALO_NORMAL_H}h"
else
  PROXIMO_INTERVALO_S=$((INTERVALO_NORMAL_H * 3600))
fi

PROXIMA_NOVA_EPOCH=$((AGORA_EPOCH + PROXIMO_INTERVALO_S))
python3 -c "
import json
json.dump({'proxima_execucao_epoch': $PROXIMA_NOVA_EPOCH, 'ultima_execucao_epoch': $AGORA_EPOCH, 'ultimos_itens_novos': $ITENS_NOVOS}, open('$STATE_FILE', 'w'), indent=2)
"
echo "Próxima varredura agendada para: $(date -u -d "@$PROXIMA_NOVA_EPOCH" -Iseconds)"
