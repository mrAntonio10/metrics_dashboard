# 🚀 Guía de Despliegue al VPS

## 📦 Archivos Nuevos Incluidos

Este despliegue incluye las siguientes mejoras:

### 1. **Sistema de Pagos con Bank Account**
- ✅ Endpoint `/api/payments/bank-payments` - Lista pagos ACH
- ✅ Endpoint `/api/payments/charges` - Lista pagos con tarjeta
- ✅ Componente con tabs en `/payment-history`
- ✅ Por defecto muestra Bank Account payments

### 2. **Generador de Métricas**
- ✅ Script `generate-metrics-simple.sh` - Genera `metrics.json`
- ✅ Configuración automática de cron job
- ✅ Soluciona el error `ENOENT: no such file or directory`

## 🔧 Pasos para Desplegar

### Opción 1: Despliegue Automático (Recomendado)

```bash
# 1. Desde tu local, sincronizar archivos al VPS
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  ./ root@134.199.199.56:~/mr/vivace-metrics/metrics_dashboard/

# 2. Conectarte al VPS
ssh root@134.199.199.56

# 3. Ir al directorio del proyecto
cd ~/mr/vivace-metrics/metrics_dashboard/

# 4. Ejecutar el script de despliegue
bash deploy_dashboard.sh
```

El script `deploy_dashboard.sh` ahora hace TODO automáticamente:
- ✅ Build de la aplicación
- ✅ Construcción de la imagen Docker
- ✅ Despliegue del contenedor
- ✅ **Instalación del generador de métricas**
- ✅ **Configuración del cron job**
- ✅ **Generación inicial de métricas**

### Opción 2: Despliegue Manual

Si prefieres control total:

```bash
# 1. Sincronizar archivos
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  ./ root@134.199.199.56:~/mr/vivace-metrics/metrics_dashboard/

# 2. Conectarte al VPS
ssh root@134.199.199.56

# 3. Ir al directorio
cd ~/mr/vivace-metrics/metrics_dashboard/

# 4. Instalar dependencias (si es necesario)
npm install

# 5. Build
npm run build

# 6. Construir imagen Docker
docker build -t metrics-dashboard:latest .

# 7. Detener contenedor anterior
docker stop metrics-dashboard 2>/dev/null || true
docker rm metrics-dashboard 2>/dev/null || true

# 8. Ejecutar nuevo contenedor
docker run -d \
  --name metrics-dashboard \
  --restart=unless-stopped \
  --network metrics-net \
  -e TZ=America/La_Paz \
  -p 9002:9002 \
  -e BILLING_WEBHOOK="https://n8n.uqminds.org/webhook/invoice/..." \
  -e STRIPE_SECRET_KEY="sk_test_..." \
  -e MANAGEMENT_STATUS="TRIAL" \
  -e MANAGEMENT_DATE="2025-10-16" \
  -e COMPANY_NAME="It's Vivace Music Academy & More, LLC" \
  -e COMPANY_KEY="prod" \
  -e DATABASE_URL="mysql://user:pass@host:3306/dbname" \
  -v /var/lib/vivace-metrics:/var/lib/vivace-metrics:rw \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /root/vivace-api:/root/vivace-api:rw \
  metrics-dashboard:latest

# 9. Instalar generador de métricas
sudo cp generate-metrics-simple.sh /usr/local/bin/generate-metrics.sh
sudo chmod +x /usr/local/bin/generate-metrics.sh

# 10. Crear directorios
sudo mkdir -p /var/lib/vivace-metrics/history

# 11. Generar métricas iniciales
sudo /usr/local/bin/generate-metrics.sh

# 12. Configurar cron job (cada 5 minutos)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1") | crontab -
```

## ✅ Verificación Post-Despliegue

### 1. Verificar que el contenedor está corriendo

```bash
docker ps | grep metrics-dashboard
```

Deberías ver algo como:
```
CONTAINER ID   IMAGE                        STATUS          PORTS
abc123def456   metrics-dashboard:latest     Up 2 minutes    0.0.0.0:9002->9002/tcp
```

### 2. Verificar que las métricas se generaron

```bash
# Ver el archivo de métricas
cat /var/lib/vivace-metrics/metrics.json | jq .

# Ver logs del generador
tail -f /var/log/metrics-generator.log
```

### 3. Probar los endpoints

```bash
# Endpoint de usage/métricas
curl http://localhost:9002/api/usage | jq .

# Endpoint de pagos con bank account
curl http://localhost:9002/api/payments/bank-payments | jq .

# Endpoint de pagos con tarjeta
curl http://localhost:9002/api/payments/charges | jq .
```

### 4. Verificar el cron job

```bash
# Ver cron jobs configurados
crontab -l

# Deberías ver:
# */5 * * * * /usr/local/bin/generate-metrics.sh >> /var/log/metrics-generator.log 2>&1
```

### 5. Acceder desde el navegador

Abre tu navegador y visita:

- 🏠 Dashboard: http://134.199.199.56:9002
- 📊 Usage: http://134.199.199.56:9002/usage
- 💳 Payment History: http://134.199.199.56:9002/payment-history

## 🐛 Troubleshooting

### Problema: Error "ENOENT: no such file or directory, open '/var/lib/vivace-metrics/metrics.json'"

**Solución:**
```bash
# Generar métricas manualmente
sudo /usr/local/bin/generate-metrics.sh

# Verificar que se creó
ls -la /var/lib/vivace-metrics/metrics.json
```

### Problema: No se muestran pagos en Payment History

**Posibles causas:**
1. **No hay pagos en Stripe** - Es normal si es entorno de prueba
2. **Clave de Stripe incorrecta** - Verificar `STRIPE_SECRET_KEY`

**Verificar:**
```bash
# Ver logs del contenedor
docker logs metrics-dashboard --tail 100

# Probar endpoint directamente
curl http://localhost:9002/api/payments/charges | jq .
```

### Problema: El generador de métricas falla

**Verificar:**
```bash
# Ejecutar manualmente para ver errores
sudo /usr/local/bin/generate-metrics.sh

# Ver logs
tail -50 /var/log/metrics-generator.log

# Verificar que Docker funciona
docker ps
docker version
```

### Problema: El cron job no se ejecuta

**Solución:**
```bash
# Verificar que está configurado
crontab -l

# Ver logs del cron
grep CRON /var/log/syslog

# Ejecutar manualmente para verificar
/usr/local/bin/generate-metrics.sh
```

## 📝 Logs Importantes

```bash
# Logs del contenedor dashboard
docker logs -f metrics-dashboard

# Logs del generador de métricas
tail -f /var/log/metrics-generator.log

# Logs del sistema (cron)
tail -f /var/log/syslog | grep CRON
```

## 🔄 Actualizar después del primer despliegue

Para actualizaciones futuras:

```bash
# Desde tu local
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  ./ root@134.199.199.56:~/mr/vivace-metrics/metrics_dashboard/

# En el VPS
ssh root@134.199.199.56
cd ~/mr/vivace-metrics/metrics_dashboard/
bash deploy_dashboard.sh
```

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs con los comandos de arriba
2. Verifica que Docker está corriendo
3. Verifica que las variables de entorno están configuradas
4. Verifica que el puerto 9002 no está siendo usado por otro proceso
