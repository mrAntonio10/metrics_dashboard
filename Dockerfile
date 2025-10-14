FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002
ENV NEXT_TELEMETRY_DISABLED=1

COPY .next/standalone ./
COPY .next/static ./.next/static
COPY .next/BUILD_ID ./.next/BUILD_ID

EXPOSE 9002
CMD ["node","server.js"]

