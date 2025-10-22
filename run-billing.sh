#!/usr/bin/env bash
set -Eeuo pipefail

# ===== CONFIG =====
WEBHOOK_URL="https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a"
TENANTS_DIR="/root/mr/vivace-api"
ENV_GLOB=".env.*"
LOG_DIR="/var/log/tenant-export"
DATE_BIN="/bin/date"
CURL_BIN="/usr/bin/curl"
HOST="$(hostname -f 2>/dev/null || hostname)"
TS="$($DATE_BIN -u +"%Y-%m-%dT%H:%M:%SZ")"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/run-${TS}.log"

# ===== LOCK =====
LOCK="/tmp/run-tenants-to-n8n.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$TS] Otro proceso en curso. Saliendo." | tee -a "$LOG_FILE"
  exit 0
fi

# ===== Helpers =====
trim() { sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

read_env_file() {
  local file="$1"
  declare -gA ENV
  ENV=()
  while IFS='' read -r line || [ -n "$line" ]; do
    line="$(printf '%s' "$line" | trim)"
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    line="${line#export }"
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(printf '%s' "$key" | trim)"
    val="$(printf '%s' "$val" | sed -e 's/^"//; s/"$//' -e "s/^'//; s/'$//")"
    ENV["$key"]="$val"
  done < "$file"
}

num_or_default() {
  # imprime un número válido o default
  local v="${1:-}"
  local def="${2:-0}"
  if [[ "$v" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    printf '%s' "$v"
  else
    printf '%s' "$def"
  fi
}

calc_total() {
  # usa python3 para multiplicar con decimales y formatear a 2 decimales
  python3 - <<PY "$1" "$2"
import sys
q=float(sys.argv[1]); r=float(sys.argv[2])
print(f"{q*r:.2f}")
PY
}

echo "[$TS] Inicio. Host=$HOST, Webhook=$WEBHOOK_URL" | tee -a "$LOG_FILE"

shopt -s nullglob
count_sent=0
for f in "$TENANTS_DIR"/$ENV_GLOB; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"   # .env.client1
  tenantId="${base#*.env.}" # client1

  echo "[$TS] Procesando $f (tenant=$tenantId)" | tee -a "$LOG_FILE"
  read_env_file "$f"

  # === Extrae datos ===
  TENANT_NAME="${ENV[TENANT_NAME]:-${ENV[APP_TENANT_NAME]:-$tenantId}}"

  # Precio por usuario (RATE)
  RATE_RAW="$(num_or_default "${ENV[BILLING_USER_PRICE]:-0}" "0")"

  # Cantidad (QUANTITY): intenta varias keys conocidas; si no hay, usa 1
  QTY_RAW="${ENV[BILLING_ACTIVE_USERS]:-${ENV[ACTIVE_USERS]:-${ENV[USERS_COUNT]:-1}}}"
  QTY="$(num_or_default "$QTY_RAW" "1")"

  # TOTAL = QUANTITY * RATE (2 decimales)
  TOTAL="$(calc_total "$QTY" "$RATE_RAW")"

  # Campos extra opcionales para detalle
  CHATS_ENABLED="${ENV[BILLING_CHATS_ENABLED]:-false}"
  CHATS_PRICE="$(num_or_default "${ENV[BILLING_CHATS_PRICE]:-0}" "0")"
  MANAGEMENT_DATE="${ENV[MANAGEMENT_DATE]:-${ENV[BILLING_MANAGEMENT_DATE]:-}}"

  DESCRIPTION="Billing ${tenantId} - ${TENANT_NAME} @ ${TS}"
  COMPANY_NAME="$TENANT_NAME"
  DETAIL="env=${f}; chatsEnabled=${CHATS_ENABLED}; chatsPrice=${CHATS_PRICE}; managementDate=${MANAGEMENT_DATE}; host=${HOST}"

  # === Construye payload EXACTO que tu n8n/Sheet espera ===
  payload=$(cat <<JSON
{
  "DESCRIPTION": "$(printf '%s' "$DESCRIPTION")",
  "QUANTITY": $QTY,
  "RATE": $RATE_RAW,
  "TOTAL": $TOTAL,
  "COMPANY_NAME": "$(printf '%s' "$COMPANY_NAME")",
  "DETAIL": "$(printf '%s' "$DETAIL")"
}
JSON
)

  HTTP_CODE=$($CURL_BIN -sS -o /tmp/n8n.out \
    -w "%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "content-type: application/json" \
    --data "$payload" \
    --connect-timeout 10 \
    --max-time 30)

  echo "[$TS] $f → HTTP $HTTP_CODE" | tee -a "$LOG_FILE"
  echo "Body:" | tee -a "$LOG_FILE"
  sed -e 's/^/[body] /' /tmp/n8n.out | tee -a "$LOG_FILE"

  if [[ "$HTTP_CODE" != 2* && "$HTTP_CODE" != "200" ]]; then
    echo "[$TS] ERROR enviando $f (HTTP $HTTP_CODE). Abortando." | tee -a "$LOG_FILE"
    exit 1
  fi

  ((count_sent++))
done

echo "[$TS] OK. Tenants enviados: $count_sent" | tee -a "$LOG_FILE"
