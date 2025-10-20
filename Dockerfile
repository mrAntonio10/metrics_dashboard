FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002
ENV NEXT_TELEMETRY_DISABLED=1

COPY .next/standalone ./          # trae server.js
COPY .next/static ./.next/static
COPY .next/BUILD_ID ./.next/BUILD_ID

# Copia cron y entry (como módulos ESM)
COPY cron.js ./cron.js
COPY server-with-cron.js ./server-with-cron.js

EXPOSE 9002
# Ejecuta como ESM forzando extensión .mjs en el entry:
# opción A: renombra server-with-cron.js -> server-with-cron.mjs
# y usa:
# CMD ["node","server-with-cron.mjs"]

# opción B: mantén .js pero añade type:module en package.json dentro del standalone (menos práctico).
CMD ["node","server-with-cron.js"]
