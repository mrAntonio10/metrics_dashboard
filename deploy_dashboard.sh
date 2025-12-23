#!/usr/bin/env bash
set -e

echo "==> Creando red Docker (si no existe)..."
docker network create metrics-net >/dev/null 2>&1 || true

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
  --network metrics-net \
  -e TZ=America/La_Paz \
  -p 9002:9002 \
  -e BILLING_WEBHOOK="https://n8n.uqminds.org/webhook/invoice/8face104-05ef-4944-b956-de775fbf389d" \
  -e MANAGEMENT_STATUS="TRIAL" \
  -e STRIPE_SECRET_KEY="sk_test_51SCsTp0zcqINwdzuB8nRcxz79JUn660NvZnXdrw14nNK13k5ZeCN4ofnECfyPVwFpQFoftOxZ0u4DrG7vCK1F25X00wfl71eff" \
  -e MANAGEMENT_DATE="2025-10-16" \
  -e COMPANY_NAME="It's Vivace Music Academy & More, LLC" \
  -e COMPANY_KEY="prod" \
  -e DATABASE_URL="mysql://user:pass@host:3306/dbname?ssl=false" \
  -e METRICS_PATH=/var/lib/vivace-metrics/metrics.json \
  -e METRICS_HISTORY_DIR=/var/lib/vivace-metrics/history \
  -e METRICS_HISTORY_FILE=/var/lib/vivace-metrics/history.json \
  -e TENANTS_DIR="/root/vivace-api" \
  -v /var/lib/vivace-metrics:/var/lib/vivace-metrics:rw \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /root/vivace-api:/root/vivace-api:rw \
  metrics-dashboard:latest

echo "==> Limpiando imágenes colgantes..."
docker image prune -f

echo "==> Instalando generador de métricas..."
# Copiar script al sistema (usar versión simple)
sudo cp generate-metrics-simple.sh /usr/local/bin/generate-metrics.sh
sudo chmod +x /usr/local/bin/generate-metrics.sh

# Crear directorio de métricas si no existe
sudo mkdir -p /var/lib/vivace-metrics/history

# Ejecutar una vez para inicializar
echo "==> Generando métricas iniciales..."
sudo /usr/local/bin/generate-metrics.sh || echo "⚠️  Advertencia: No se pudieron generar métricas iniciales"

# Verificar si ya existe el cron job
if ! crontab -l 2>/dev/null | grep -q "generate-metrics.sh"; then
  echo "==> Configurando cron job para métricas (cada 5 minutos)..."
  (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1") | crontab -
  echo "✅ Cron job configurado"
else
  echo "✅ Cron job ya existe"
fi

echo ""
echo "==> Despliegue completado correctamente ✅"
echo ""
echo "📊 Endpoints disponibles:"
echo "   - Dashboard: http://localhost:9002"
echo "   - Usage API: http://localhost:9002/api/usage"
echo "   - Payment History: http://localhost:9002/payment-history"
echo ""
echo "📝 Logs de métricas: tail -f /var/log/metrics-generator.log"

