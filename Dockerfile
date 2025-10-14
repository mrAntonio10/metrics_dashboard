# Dockerfile (runner-only para build standalone)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002

# Copia los artefactos de build standalone
# Estructura esperada:
#   .next/standalone  (contiene server.js y app)
#   .next/static
#   public            (si existe)
COPY .next/standalone ./         # copia server.js y el bundle standalone
COPY .next/static ./.next/static # assets
COPY public ./public             # opcional

EXPOSE 9002

# server.js es el entrypoint generado por Next en modo 'standalone'
CMD ["node","server.js"]
