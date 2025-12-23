# Metrics Dashboard

Dashboard de métricas y pagos para Vivace.

## 📊 Configuración de Métricas - SNAPSHOTS DIARIOS

### ⏰ Generación Automática de Snapshots

El sistema genera snapshots diarios de métricas de contenedores Docker automáticamente a las **2:00 AM** cada día.

**Cron job configurado:**
```bash
0 2 * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1
```

### 📁 Archivos generados:
- `/var/lib/vivace-metrics/metrics.json` - Último snapshot
- `/var/lib/vivace-metrics/history/YYYY-MM-DD.json` - Historial diario

---

## ✅ Verificar configuración en el servidor

### Paso 1: Ver cron job configurado
```bash
crontab -l
```

**Deberías ver:**
```
0 2 * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1
```

**Si NO lo ves, agregarlo manualmente:**
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1") | crontab -
```

### Paso 2: Verificar que el script existe
```bash
ls -lh /usr/local/bin/generate-metrics.sh
```

**Deberías ver:**
```
-rwxr-xr-x 1 root root 3.5K Dec 23 10:00 /usr/local/bin/generate-metrics.sh
```

**Si no tiene permisos:**
```bash
chmod +x /usr/local/bin/generate-metrics.sh
```

### Paso 3: Ejecutar manualmente para probar
```bash
/usr/local/bin/generate-metrics.sh
```

**Deberías ver:**
```
[2025-12-23T10:30:00Z] ✅ Metrics generated: 5 containers
```

### Paso 4: Ver último snapshot
```bash
cat /var/lib/vivace-metrics/metrics.json | jq .
```

### Paso 5: Ver historial
```bash
ls -lh /var/lib/vivace-metrics/history/
```

### Paso 6: Ver logs de ejecución
```bash
tail -f /var/log/metrics-generator.log
```

---

## 🔧 Cambiar horario del snapshot

Si quieres cambiar el horario de ejecución:

```bash
crontab -e
```

**Ejemplos de configuración:**

```bash
# Diario a las 2:00 AM (CONFIGURACIÓN ACTUAL)
0 2 * * *

# Diario a las 3:00 AM
0 3 * * *

# Dos veces al día (2 AM y 2 PM)
0 2,14 * * *

# Cada hora
0 * * * *

# Cada 12 horas (2 AM y 2 PM)
0 2,14 * * *

# Todos los lunes a las 2 AM
0 2 * * 1
```

---

## 🚀 Despliegue al VPS

### Opción 1: Deploy automático (Recomendado)

```bash
# 1. Sincronizar archivos desde tu local
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  ./ root@134.199.199.56:~/mr/vivace-metrics/metrics_dashboard/

# 2. Conectar y ejecutar deploy
ssh root@134.199.199.56
cd ~/mr/vivace-metrics/metrics_dashboard/
bash deploy_dashboard.sh
```

El script `deploy_dashboard.sh` hace TODO automáticamente:
- ✅ Build de la aplicación
- ✅ Construcción de imagen Docker
- ✅ Despliegue del contenedor
- ✅ Instalación del generador de métricas
- ✅ Configuración del cron job (2:00 AM diario)
- ✅ Generación del snapshot inicial

---

## 🌐 Endpoints Disponibles

- **Dashboard:** http://134.199.199.56:9002
- **Usage/Metrics:** http://134.199.199.56:9002/usage
- **Payment History:** http://134.199.199.56:9002/payment-history
  - Por defecto muestra: Bank Account Payments
  - Switch para: Card Payments

---

## 📚 Documentación Completa

- **[DEPLOY_TO_VPS.md](DEPLOY_TO_VPS.md)** - Guía completa de despliegue
- **[SETUP_METRICS.md](SETUP_METRICS.md)** - Configuración detallada de métricas

---

## 🐛 Troubleshooting

### El snapshot no se genera a las 2 AM

```bash
# Verificar que el cron está configurado
crontab -l

# Ver logs del cron
grep CRON /var/log/syslog

# Ver logs del generador
tail -50 /var/log/metrics-generator.log
```

### Error: "ENOENT: no such file or directory"

```bash
# Ejecutar manualmente el generador
sudo /usr/local/bin/generate-metrics.sh

# Verificar que se creó
ls -la /var/lib/vivace-metrics/metrics.json
```

### Forzar ejecución inmediata (sin esperar a las 2 AM)

```bash
# Ejecutar manualmente
/usr/local/bin/generate-metrics.sh

# O cambiar temporalmente el cron para que se ejecute en 5 minutos
# (luego volver a cambiarlo a 2 AM)
```

---

## 📝 Logs Importantes

```bash
# Logs del dashboard
docker logs -f metrics-dashboard

# Logs del generador de métricas
tail -f /var/log/metrics-generator.log

# Logs del sistema (cron)
tail -f /var/log/syslog | grep CRON
```
