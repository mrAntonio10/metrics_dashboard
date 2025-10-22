#!/usr/bin/env bash
set -e

echo "==> Ejecutando build de npm..."
npm run build

echo "==> Deteniendo contenedor anterior (si existe)..."
docker stop metrics-dashboard 2>/dev/null || true
docker rm metrics-dashboard 2>/dev/null || true

echo "==> Construyendo imagen Docker..."
docker build -t metrics-dashboard:latest .

echo "==> Ejecutando nuevo contenedor..."
docker run -d \
  --name metrics-dashboard \
  --restart=unless-stopped \
  -p 9002:9002 \
  -e TZ=America/La_Paz \
  -e BILLING_WEBHOOK="https://n8n.uqminds.org/webhook/d005f867-3f6f-415e-8068-57d6b22b691a" \
  -e MANAGEMENT_STATUS="TRIAL" \
  -e MANAGEMENT_DATE="2025-10-16" \
  -e COMPANY_NAME="It's Vivace Music Academy & More, LLC" \
  -e COMPANY_KEY="prod" \
  -e DATABASE_URL="mysql://user:pass@host:3306/dbname?ssl=false" \
  -e METRICS_PATH=/var/lib/vivace-metrics/metrics.json \
  -e METRICS_HISTORY_DIR=/var/lib/vivace-metrics/history \
  -e METRICS_HISTORY_FILE=/var/lib/vivace-metrics/history.json \
  -e TENANTS_DIR="/root/mr/vivace-api" \   # <-- AÑADIDO
  -v /var/lib/vivace-metrics:/var/lib/vivace-metrics:ro \
  -v /root/mr/vivace-api:/root/mr/vivace-api:ro \      # lectura basta para .env.*
  metrics-dashboard:latest


echo "==> Limpiando imágenes colgantes..."
docker image prune -f

echo "==> Despliegue completado correctamente ✅"

