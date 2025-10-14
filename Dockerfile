# Dockerfile (runner-only para build standalone)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002

# Copia artefactos ya construidos
COPY .next/standalone ./         # server.js + bundle
COPY .next/static ./.next/static # assets
# (no copies public si no existe)
# COPY public ./public

EXPOSE 9002
CMD ["node","server.js"]
