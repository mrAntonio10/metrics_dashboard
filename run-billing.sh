#!/usr/bin/env bash
set -Eeuo pipefail

# ===== CONFIG =====
WEBHOOK_URL="https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a"  # <--- tu webhook n8n
TENANTS_DIR="/root/mr/vivace-api"   # carpeta donde están los .env.*
ENV_GLOB=".env.*"
LOG_DIR="/var/log/tenant-export"
DATE_BIN="/bin/date"
CURL_BIN="/usr/bin/curl"
HOST="$(hostname -f 2>/dev/null || hostname)"
TS="$($DATE_BIN -u +"%Y-%m-%dT%H:%M:%SZ")"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/run-${TS}.log"

# ===== LOCK para no solapar =====
LOCK="/tmp/run-tenants-to-n8n.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$TS] Otro proceso en curso. Saliendo." | tee -a "$LOG_FILE"
  exit 0
fi

# ===== Helpers =====
trim() { sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

json_escape() {
  # Requiere python3 (suele venir por defecto en Ubuntu)
  python3 - <<'PY' "$1"
import json,sys
s=sys.argv[1]
print(json.dumps(s)[1:-1])
PY
}

boolify() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|y|Y|on|ON) echo "true" ;;
    0|false|FALSE|no|NO|n|N|off|OFF|"") echo "false" ;;
    *) echo "false" ;;
  esac
}

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
    # quita comillas si envuelve
    val="$(printf '%s' "$val" | sed -e 's/^"//; s/"$//' -e "s/^'//; s/'$//")"
    ENV["$key"]="$val"
  done < "$file"
}

echo "[$TS] Inicio. Host=$HOST, Webhook=$WEBHOOK_URL" | tee -a "$LOG_FILE"

shopt -s nullglob
count_sent=0
for f in "$TENANTS_DIR"/$ENV_GLOB; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"            # .env.client1
  tenantId="${base#*.env.}"          # client1

  echo "[$TS] Procesando $f (tenant=$tenantId)" | tee -a "$LOG_FILE"
  read_env_file "$f"

  TENANT_NAME="${ENV[TENANT_NAME]:-${ENV[APP_TENANT_NAME]:-$tenantId}}"
  USER_PRICE="${ENV[BILLING_USER_PRICE]:-0}"
  CHATS_ENABLED="$(boolify "${ENV[BILLING_CHATS_ENABLED]:-false}")"
  CHATS_PRICE="${ENV[BILLING_CHATS_PRICE]:-0}"
  MANAGEMENT_DATE="${ENV[MANAGEMENT_DATE]:-${ENV[BILLING_MANAGEMENT_DATE]:-}}"

  payload=$(
    cat <<JSON
{
  "timestamp":"$(json_escape "$TS")",
  "host":"$(json_escape "$HOST")",
  "envFile":"$(json_escape "$f")",
  "tenant":{"id":"$(json_escape "$tenantId")","name":"$(json_escape "$TENANT_NAME")"},
  "billing":{
    "userPrice": $USER_PRICE,
    "chatsEnabled": $CHATS_ENABLED,
    "chatsPrice": $CHATS_PRICE,
    "managementDate": "$(json_escape "$MANAGEMENT_DATE")"
  },
  "raw":{
    "BILLING_USER_PRICE":"$(json_escape "${ENV[BILLING_USER_PRICE]:-}")",
    "BILLING_CHATS_ENABLED":"$(json_escape "${ENV[BILLING_CHATS_ENABLED]:-}")",
    "BILLING_CHATS_PRICE":"$(json_escape "${ENV[BILLING_CHATS_PRICE]:-}")"
  }
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
