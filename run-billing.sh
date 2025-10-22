#!/usr/bin/env bash
set -euo pipefail

# Config
URL="https://tudominio.com/api/billing/run"   # AJUSTA AQUÍ
SECRET="pon-el-mismo-valor-que-BILLING_RUN_SECRET"
LOG_DIR="/var/log/billing"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/run-${TS}.log"

# Lock para no solapar ejecuciones
LOCK="/tmp/run-billing.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$TS] Otra ejecución en curso. Saliendo." | tee -a "$LOG_FILE"
  exit 0
fi

echo "[$TS] Llamando $URL" | tee -a "$LOG_FILE"
HTTP_CODE=$(curl -sS -o /tmp/run-billing.out \
  -w "%{http_code}" \
  -X POST "$URL" \
  -H "x-run-secret: $SECRET" \
  -H "user-agent: billing-cron/1.0")

echo "[$TS] HTTP $HTTP_CODE" | tee -a "$LOG_FILE"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Body:" | tee -a "$LOG_FILE"
  sed -e 's/^/[body] /' /tmp/run-billing.out | tee -a "$LOG_FILE"
  exit 1
fi

echo "Body:" | tee -a "$LOG_FILE"
sed -e 's/^/[body] /' /tmp/run-billing.out | tee -a "$LOG_FILE"
echo "[$TS] OK" | tee -a "$LOG_FILE"

