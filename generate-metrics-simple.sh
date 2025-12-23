#!/usr/bin/env bash
# generate-metrics-simple.sh - Versión simplificada del generador de métricas
set -euo pipefail

METRICS_DIR="${VIVACE_METRICS_DIR:-/var/lib/vivace-metrics}"
METRICS_FILE="${METRICS_DIR}/metrics.json"
HISTORY_DIR="${METRICS_DIR}/history"
TEMP_FILE="${METRICS_DIR}/metrics.tmp.json"

# Crear directorios si no existen
mkdir -p "$METRICS_DIR" "$HISTORY_DIR"

# Obtener información básica
HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

# Verificar si Docker está disponible
if ! command -v docker &>/dev/null; then
  echo "❌ Error: Docker no está instalado" >&2
  exit 1
fi

# Verificar si jq está disponible
if ! command -v jq &>/dev/null; then
  echo "⚠️  Advertencia: jq no está instalado. Instalando..." >&2
  # Intentar instalar jq según el sistema
  if command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq jq
  elif command -v yum &>/dev/null; then
    yum install -y -q jq
  elif command -v apk &>/dev/null; then
    apk add --no-cache jq
  else
    echo "❌ Error: No se pudo instalar jq automáticamente" >&2
    exit 1
  fi
fi

# Obtener información de Docker
DOCKER_RUNNING="true"
DOCKER_SERVER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
DOCKER_CLIENT_VERSION=$(docker version --format '{{.Client.Version}}' 2>/dev/null || echo "unknown")
DOCKER_CONTEXT=$(docker context show 2>/dev/null || echo "default")

# Obtener lista de contenedores
CONTAINERS_RAW=$(docker ps --no-trunc --format '{{json .}}' 2>/dev/null || echo "")

if [ -z "$CONTAINERS_RAW" ]; then
  # No hay contenedores, crear estructura vacía
  cat > "$TEMP_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "host": "$HOSTNAME",
  "docker": {
    "running": $DOCKER_RUNNING,
    "server_version": "$DOCKER_SERVER_VERSION",
    "client_version": "$DOCKER_CLIENT_VERSION",
    "context": "$DOCKER_CONTEXT"
  },
  "containers": [],
  "clients": [],
  "client_agg": [],
  "total_containers": 0,
  "generated_at": "$GENERATED_AT"
}
EOF
else
  # Procesar contenedores con jq
  CONTAINERS_JSON=$(echo "$CONTAINERS_RAW" | jq -s '
    map({
      id: .ID,
      name: .Names,
      image: .Image,
      status: .Status,
      ports_list: .Ports,
      client: (.Names | split("_")[0]),
      role: "app",
      tls: {exposes_443: (.Ports | contains("443"))},
      started_at: "",
      uptime_seconds: null,
      stats: {
        cpu_percent: 0,
        mem_used_bytes: 0,
        mem_limit_bytes: 0,
        mem_percent: 0,
        net_rx_bytes: 0,
        net_tx_bytes: 0,
        block_read_bytes: 0,
        block_write_bytes: 0,
        pids: 0
      }
    })
  ')

  # Extraer lista de clients únicos
  CLIENTS=$(echo "$CONTAINERS_JSON" | jq '[.[].client] | unique')

  # Agregar por cliente
  CLIENT_AGG=$(echo "$CONTAINERS_JSON" | jq '
    group_by(.client) | map({
      client: .[0].client,
      containers: length,
      cpu_percent_sum: 0,
      mem_used_bytes_sum: 0,
      mem_limit_bytes_sum: 0,
      net_rx_bytes_sum: 0,
      net_tx_bytes_sum: 0
    })
  ')

  # Contar total
  TOTAL_CONTAINERS=$(echo "$CONTAINERS_JSON" | jq 'length')

  # Crear archivo JSON final
  jq -n \
    --arg ts "$TIMESTAMP" \
    --arg host "$HOSTNAME" \
    --arg docker_running "$DOCKER_RUNNING" \
    --arg docker_sv "$DOCKER_SERVER_VERSION" \
    --arg docker_cv "$DOCKER_CLIENT_VERSION" \
    --arg docker_ctx "$DOCKER_CONTEXT" \
    --argjson containers "$CONTAINERS_JSON" \
    --argjson clients "$CLIENTS" \
    --argjson client_agg "$CLIENT_AGG" \
    --argjson total "$TOTAL_CONTAINERS" \
    --arg generated "$GENERATED_AT" \
    '{
      timestamp: $ts,
      host: $host,
      docker: {
        running: ($docker_running == "true"),
        server_version: $docker_sv,
        client_version: $docker_cv,
        context: $docker_ctx
      },
      containers: $containers,
      clients: $clients,
      client_agg: $client_agg,
      total_containers: $total,
      generated_at: $generated
    }' > "$TEMP_FILE"
fi

# Mover archivo temporal al definitivo (operación atómica)
mv "$TEMP_FILE" "$METRICS_FILE"

# Guardar en historial diario
TODAY=$(date +%Y-%m-%d)
HISTORY_FILE="${HISTORY_DIR}/${TODAY}.json"
cp "$METRICS_FILE" "$HISTORY_FILE"

# Output para logs
TOTAL_COUNT=$(jq -r '.total_containers' "$METRICS_FILE" 2>/dev/null || echo "0")
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✅ Metrics generated: $TOTAL_COUNT containers"
