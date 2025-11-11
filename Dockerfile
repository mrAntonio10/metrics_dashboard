FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache docker-cli
# Copia el output standalone de Next (incluye server.js)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY .next/BUILD_ID ./.next/BUILD_ID

# Copia cron y el bootstrap
COPY cron.js ./cron.js
COPY start.mjs ./start.mjs

EXPOSE 9002
CMD ["node","start.mjs"]

