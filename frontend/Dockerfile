# ─────────────────────────────────────────────
# UJAP Parking — Frontend
# ─────────────────────────────────────────────

FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* se incrusta en el JavaScript que va al navegador, así que se
# fija AL CONSTRUIR y no al arrancar. Ponerlo como variable de entorno del
# contenedor no serviría de nada: el bundle ya está escrito.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Producción ───────────────────────────────
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sin esto server.js escucha solo en localhost DENTRO del contenedor y nadie
# de fuera lo alcanza.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# `output: 'standalone'` (next.config.ts) deja en .next/standalone el servidor
# con sus dependencias mínimas. Los estáticos y public van aparte.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN apk add --no-cache curl

USER node

EXPOSE 3000

CMD ["node", "server.js"]
