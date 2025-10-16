#!/usr/bin/env bash
# deploy_metrics_dashboard.sh
# Script para compilar, reconstruir y ejecutar metrics-dashboard

set -e

echo "==> Ejecutando build de npm..."
npm run build

echo "==> Deteniendo contenedor anterior (si existe)..."
docker stop metrics-dashboard 2>/dev/null || true

echo "==> Eliminando contenedor anterior (si existe)..."
docker rm metrics-dashboard 2>/dev/null || true

echo "==> Construyendo imagen Docker..."
docker build -t metrics-dashboard:latest .

echo "==> Ejecutando nuevo contenedor..."
docker run -d \
  --name metrics-dashboard \
  --restart=unless-stopped \
  -p 9002:9002 \
  -e METRICS_PATH=/var/lib/vivace-metrics/metrics.json \
  -e METRICS_HISTORY_DIR=/var/lib/vivace-metrics/history \
  -e METRICS_HISTORY_FILE=/var/lib/vivace-metrics/history.json \
  -v /var/lib/vivace-metrics:/var/lib/vivace-metrics:ro \
  -v /root/mr/vivace-api:/root/mr/vivace-api:rw \
  metrics-dashboard:latest

echo "==> Limpiando imágenes colgantes..."
docker image prune -f

echo "==> Despliegue completado correctamente ✅"

