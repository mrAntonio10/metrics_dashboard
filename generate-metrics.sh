#!/usr/bin/env bash
# generate-metrics.sh - Genera metrics.json con información de contenedores Docker
set -euo pipefail

# Configuración
METRICS_DIR="${VIVACE_METRICS_DIR:-/var/lib/vivace-metrics}"
METRICS_FILE="${METRICS_DIR}/metrics.json"
HISTORY_DIR="${METRICS_DIR}/history"
TEMP_FILE="${METRICS_DIR}/metrics.tmp.json"

# Crear directorios si no existen
mkdir -p "$METRICS_DIR" "$HISTORY_DIR"

# Función para obtener información de Docker
get_docker_info() {
  if ! docker info &>/dev/null; then
    echo '{"running":false,"server_version":"","client_version":"","context":""}' | jq -c .
    return
  fi

  local server_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
  local client_version=$(docker version --format '{{.Client.Version}}' 2>/dev/null || echo "unknown")
  local context=$(docker context show 2>/dev/null || echo "default")

  jq -n \
    --arg sv "$server_version" \
    --arg cv "$client_version" \
    --arg ctx "$context" \
    '{running:true, server_version:$sv, client_version:$cv, context:$ctx}'
}

# Función para obtener estadísticas de un contenedor
get_container_stats() {
  local container_id="$1"

  # Obtener stats (sin streaming)
  local stats=$(docker stats "$container_id" --no-stream --format '{{json .}}' 2>/dev/null || echo '{}')

  if [ "$stats" = "{}" ]; then
    echo '{
      "cpu_percent": 0,
      "mem_used_bytes": 0,
      "mem_limit_bytes": 0,
      "mem_percent": 0,
      "net_rx_bytes": 0,
      "net_tx_bytes": 0,
      "block_read_bytes": 0,
      "block_write_bytes": 0,
      "pids": 0
    }'
    return
  fi

  # Parsear stats
  local cpu=$(echo "$stats" | jq -r '.CPUPerc' | sed 's/%//')
  local mem_usage=$(echo "$stats" | jq -r '.MemUsage' | awk '{print $1}')
  local mem_limit=$(echo "$stats" | jq -r '.MemUsage' | awk '{print $3}')
  local mem_percent=$(echo "$stats" | jq -r '.MemPerc' | sed 's/%//')
  local net_io=$(echo "$stats" | jq -r '.NetIO')
  local block_io=$(echo "$stats" | jq -r '.BlockIO')
  local pids=$(echo "$stats" | jq -r '.PIDs')

  # Convertir unidades a bytes (simplificado)
  mem_used_bytes=$(echo "$mem_usage" | sed 's/[^0-9.]//g')
  mem_limit_bytes=$(echo "$mem_limit" | sed 's/[^0-9.]//g')

  # Network I/O
  net_rx=$(echo "$net_io" | awk -F'/' '{print $1}' | sed 's/[^0-9.]//g')
  net_tx=$(echo "$net_io" | awk -F'/' '{print $2}' | sed 's/[^0-9.]//g')

  # Block I/O
  block_read=$(echo "$block_io" | awk -F'/' '{print $1}' | sed 's/[^0-9.]//g')
  block_write=$(echo "$block_io" | awk -F'/' '{print $2}' | sed 's/[^0-9.]//g')

  jq -n \
    --argjson cpu "${cpu:-0}" \
    --argjson mem_used "${mem_used_bytes:-0}" \
    --argjson mem_limit "${mem_limit_bytes:-0}" \
    --argjson mem_pct "${mem_percent:-0}" \
    --argjson net_rx "${net_rx:-0}" \
    --argjson net_tx "${net_tx:-0}" \
    --argjson block_r "${block_read:-0}" \
    --argjson block_w "${block_write:-0}" \
    --argjson pids "${pids:-0}" \
    '{
      cpu_percent: $cpu,
      mem_used_bytes: $mem_used,
      mem_limit_bytes: $mem_limit,
      mem_percent: $mem_pct,
      net_rx_bytes: $net_rx,
      net_tx_bytes: $net_tx,
      block_read_bytes: $block_r,
      block_write_bytes: $block_w,
      pids: $pids
    }'
}

# Función para extraer el client ID de las labels o nombre
extract_client_id() {
  local container_name="$1"
  local labels="$2"

  # Intentar obtener de labels primero
  local client=$(echo "$labels" | jq -r '.client // empty' 2>/dev/null || echo "")

  # Si no hay label, extraer del nombre (ej: client_web_1 -> client)
  if [ -z "$client" ]; then
    client=$(echo "$container_name" | sed -E 's/^([^_]+)_.*/\1/' | sed 's/^\///')
  fi

  echo "${client:-unknown}"
}

# Obtener hostname
HOSTNAME=$(hostname)

# Obtener información de Docker
DOCKER_INFO=$(get_docker_info)

# Obtener lista de contenedores
CONTAINERS_JSON=$(docker ps --format '{{json .}}' 2>/dev/null | jq -s . || echo '[]')

# Si no hay contenedores, crear estructura vacía
if [ "$CONTAINERS_JSON" = "[]" ]; then
  cat > "$TEMP_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": "$HOSTNAME",
  "docker": $DOCKER_INFO,
  "containers": [],
  "clients": [],
  "client_agg": [],
  "total_containers": 0,
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
  mv "$TEMP_FILE" "$METRICS_FILE"
  echo "✅ Metrics generated (no containers)"
  exit 0
fi

# Procesar cada contenedor
CONTAINERS_WITH_STATS="[]"
CLIENTS_SET=()

echo "$CONTAINERS_JSON" | jq -c '.[]' | while read -r container; do
  container_id=$(echo "$container" | jq -r '.ID')
  container_name=$(echo "$container" | jq -r '.Names')

  # Obtener inspect completo para más información
  inspect=$(docker inspect "$container_id" 2>/dev/null | jq '.[0]' || echo '{}')

  # Extraer información
  image=$(echo "$inspect" | jq -r '.Config.Image // "unknown"')
  status=$(echo "$inspect" | jq -r '.State.Status // "unknown"')
  started_at=$(echo "$inspect" | jq -r '.State.StartedAt // ""')
  labels=$(echo "$inspect" | jq -r '.Config.Labels // {}')

  # Extraer client ID
  client_id=$(extract_client_id "$container_name" "$labels")

  # Calcular uptime
  uptime_seconds=0
  if [ -n "$started_at" ] && [ "$started_at" != "null" ]; then
    start_epoch=$(date -d "$started_at" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    uptime_seconds=$((now_epoch - start_epoch))
  fi

  # Obtener puertos
  ports=$(echo "$inspect" | jq -r '.NetworkSettings.Ports // {} | to_entries | map(.key) | join(", ")')

  # Verificar si expone 443
  exposes_443=$(echo "$ports" | grep -q "443" && echo "true" || echo "false")

  # Obtener role de labels si existe
  role=$(echo "$labels" | jq -r '.role // "app"')

  # Obtener stats
  stats=$(get_container_stats "$container_id")

  # Construir objeto del contenedor
  container_obj=$(jq -n \
    --arg id "$container_id" \
    --arg name "$container_name" \
    --arg image "$image" \
    --arg status "$status" \
    --arg ports "$ports" \
    --arg client "$client_id" \
    --arg role "$role" \
    --arg started "$started_at" \
    --argjson uptime "$uptime_seconds" \
    --argjson exp443 "$exposes_443" \
    --argjson stats "$stats" \
    '{
      id: $id,
      name: $name,
      image: $image,
      status: $status,
      ports_list: $ports,
      client: $client,
      role: $role,
      tls: {exposes_443: $exp443},
      started_at: $started,
      uptime_seconds: $uptime,
      stats: $stats
    }')

  CONTAINERS_WITH_STATS=$(echo "$CONTAINERS_WITH_STATS" | jq --argjson c "$container_obj" '. + [$c]')
done

# Extraer lista única de clients
CLIENTS=$(echo "$CONTAINERS_WITH_STATS" | jq -r '[.[].client] | unique')

# Agregar por cliente
CLIENT_AGG=$(echo "$CONTAINERS_WITH_STATS" | jq '
  group_by(.client) | map({
    client: .[0].client,
    containers: length,
    cpu_percent_sum: (map(.stats.cpu_percent) | add // 0),
    mem_used_bytes_sum: (map(.stats.mem_used_bytes) | add // 0),
    mem_limit_bytes_sum: (map(.stats.mem_limit_bytes) | add // 0),
    net_rx_bytes_sum: (map(.stats.net_rx_bytes) | add // 0),
    net_tx_bytes_sum: (map(.stats.net_tx_bytes) | add // 0)
  })
')

# Contar total de contenedores
TOTAL_CONTAINERS=$(echo "$CONTAINERS_WITH_STATS" | jq 'length')

# Generar archivo final
jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg host "$HOSTNAME" \
  --argjson docker "$DOCKER_INFO" \
  --argjson containers "$CONTAINERS_WITH_STATS" \
  --argjson clients "$CLIENTS" \
  --argjson client_agg "$CLIENT_AGG" \
  --argjson total "$TOTAL_CONTAINERS" \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
  '{
    timestamp: $ts,
    host: $host,
    docker: $docker,
    containers: $containers,
    clients: $clients,
    client_agg: $client_agg,
    total_containers: $total,
    generated_at: $generated
  }' > "$TEMP_FILE"

# Mover archivo temporal al definitivo (atómico)
mv "$TEMP_FILE" "$METRICS_FILE"

# Opcional: Guardar en historial diario
TODAY=$(date +%Y-%m-%d)
HISTORY_FILE="${HISTORY_DIR}/${TODAY}.json"
cp "$METRICS_FILE" "$HISTORY_FILE"

echo "✅ Metrics generated successfully"
echo "   Containers: $TOTAL_CONTAINERS"
echo "   File: $METRICS_FILE"
