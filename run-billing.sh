# /usr/local/bin/hit-billing-endpoint.sh
#!/usr/bin/env bash
set -euo pipefail
PORTAL_URL="http://127.0.0.1:9002/api/billing/run"   # o tu host:puerto real
LOG_DIR="/var/log/billing"; mkdir -p "$LOG_DIR"
TS=$(date -u +%FT%TZ); LOG_FILE="$LOG_DIR/hit-${TS}.log"
echo "[$TS] POST $PORTAL_URL" | tee -a "$LOG_FILE"
CODE=$(curl -sS -o /tmp/billing.out -w '%{http_code}' -X POST "$PORTAL_URL")
echo "[$TS] HTTP $CODE" | tee -a "$LOG_FILE"
sed -e 's/^/[body] /' /tmp/billing.out | tee -a "$LOG_FILE"
[ "$CODE" = "200" ] || exit 1
