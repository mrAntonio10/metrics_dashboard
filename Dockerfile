FROM node:20-alpine AS runner
WORKDIR /app

# --- zona horaria y dependencias mínimas ---
RUN apk add --no-cache tzdata && \
    ln -sf /usr/share/zoneinfo/America/La_Paz /etc/localtime

ENV NODE_ENV=production
ENV PORT=9002
ENV NEXT_TELEMETRY_DISABLED=1
# importante para cron: fija TZ del proceso
ENV TZ=America/La_Paz

# --- artefactos de Next standalone ---
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY .next/BUILD_ID ./.next/BUILD_ID

# --- copia tu cron.js (debes tenerlo en el root del repo) ---
# si lo pusiste en otra ruta, ajusta el COPY
COPY cron.js ./cron.js

# --- bootstrap que arranca server + cron ---
COPY start.mjs ./start.mjs

EXPOSE 9002

# usa un bootstrap que importe server.js y cron.js
CMD ["node","--enable-source-maps","start.mjs"]

