# Configuración de Métricas - Guía de Instalación

## Problema

El error `ENOENT: no such file or directory, open '/var/lib/vivace-metrics/metrics.json'` ocurre porque el archivo de métricas no existe.

## ¿Por qué sucede esto?

El dashboard **lee** el archivo `metrics.json` pero **NO lo genera**. Necesitas un script externo que:
1. Monitoree los contenedores Docker
2. Recolecte estadísticas (CPU, memoria, red)
3. Genere el archivo `/var/lib/vivace-metrics/metrics.json`

## Solución: Instalar el generador de métricas

### Paso 1: Copiar el script al servidor

Desde tu máquina local:

```bash
# Copiar el script al servidor
scp generate-metrics.sh root@134.199.199.56:/usr/local/bin/generate-metrics.sh

# O manualmente conectándote al servidor
ssh root@134.199.199.56
```

### Paso 2: Instalar el script en el servidor

```bash
# Conectarte al servidor
ssh root@134.199.199.56

# Crear el script manualmente
cat > /usr/local/bin/generate-metrics.sh << 'EOFSCRIPT'
#!/usr/bin/env bash
# generate-metrics.sh - Genera metrics.json con información de contenedores Docker
set -euo pipefail

METRICS_DIR="${VIVACE_METRICS_DIR:-/var/lib/vivace-metrics}"
METRICS_FILE="${METRICS_DIR}/metrics.json"
HISTORY_DIR="${METRICS_DIR}/history"

mkdir -p "$METRICS_DIR" "$HISTORY_DIR"

# Obtener información básica
HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Verificar si Docker está disponible
if ! command -v docker &>/dev/null; then
  echo "❌ Docker no está instalado"
  exit 1
fi

# Obtener contenedores en formato JSON
CONTAINERS=$(docker ps --format '
{
  "id": "{{.ID}}",
  "name": "{{.Names}}",
  "image": "{{.Image}}",
  "status": "{{.Status}}",
  "ports": "{{.Ports}}"
}' | jq -s '.')

# Extraer lista de clients únicos (del nombre del contenedor)
CLIENTS=$(echo "$CONTAINERS" | jq -r '[.[].name | split("_")[0]] | unique')

# Crear estructura de métricas
cat > "$METRICS_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "host": "$HOSTNAME",
  "docker": {
    "running": true,
    "server_version": "$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'unknown')",
    "client_version": "$(docker version --format '{{.Client.Version}}' 2>/dev/null || echo 'unknown')",
    "context": "$(docker context show 2>/dev/null || echo 'default')"
  },
  "containers": $CONTAINERS,
  "clients": $CLIENTS,
  "client_agg": [],
  "total_containers": $(echo "$CONTAINERS" | jq 'length'),
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF

# Guardar copia en historial
TODAY=$(date +%Y-%m-%d)
cp "$METRICS_FILE" "${HISTORY_DIR}/${TODAY}.json"

echo "✅ Metrics generated: $METRICS_FILE"
EOFSCRIPT

# Dar permisos de ejecución
chmod +x /usr/local/bin/generate-metrics.sh
```

### Paso 3: Ejecutar el script manualmente (primera vez)

```bash
# Ejecutar el script
/usr/local/bin/generate-metrics.sh

# Verificar que se creó el archivo
ls -lh /var/lib/vivace-metrics/metrics.json
cat /var/lib/vivace-metrics/metrics.json | jq .
```

### Paso 4: Configurar cron job para ejecutarlo periódicamente

```bash
# Editar crontab
crontab -e

# Agregar esta línea (ejecutar cada 5 minutos)
*/5 * * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1

# O cada minuto para datos más actualizados
* * * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1

# Guardar y salir (:wq en vim)
```

### Paso 5: Verificar que funciona

```bash
# Ver el log
tail -f /var/log/metrics-generator.log

# Esperar 1-5 minutos y verificar el archivo
cat /var/lib/vivace-metrics/metrics.json | jq .

# Probar el endpoint del dashboard
curl http://localhost:9002/api/usage | jq .
```

## Solución Rápida (Temporal)

Si solo necesitas que funcione ahora mismo:

```bash
# Conectarte al servidor
ssh root@134.199.199.56

# Crear directorios
mkdir -p /var/lib/vivace-metrics/history

# Crear archivo de métricas vacío
cat > /var/lib/vivace-metrics/metrics.json << 'EOF'
{
  "timestamp": "2025-12-23T10:00:00Z",
  "host": "vivace-server",
  "docker": {
    "running": true,
    "server_version": "24.0.0",
    "client_version": "24.0.0",
    "context": "default"
  },
  "containers": [],
  "clients": [],
  "client_agg": [],
  "total_containers": 0,
  "generated_at": "2025-12-23T10:00:00.000Z"
}
EOF

# Verificar
cat /var/lib/vivace-metrics/metrics.json | jq .
```

Luego prueba acceder a `http://134.199.199.56:9002/usage` - debería funcionar.

## Notas Importantes

1. **El script debe ejecutarse periódicamente** - Usa cron para mantener las métricas actualizadas
2. **Permisos** - Asegúrate de que el usuario tenga acceso a Docker
3. **Docker socket** - El contenedor del dashboard necesita acceso al socket de Docker (`/var/run/docker.sock`)
4. **Historial** - El script guarda una copia diaria en `/var/lib/vivace-metrics/history/`

## Verificación en el otro servidor

Si quieres ver cómo está configurado en el otro servidor:

```bash
# Buscar cron jobs que generen métricas
crontab -l | grep -i metrics

# Buscar scripts relacionados
find /usr/local/bin /root -name "*metric*" -type f 2>/dev/null

# Ver procesos relacionados
ps aux | grep -i metric
```
