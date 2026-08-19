# ─────────────────────────────────────────────
# UJAP Parking — Backend
# Multistage: `builder` se usa en desarrollo, `production` en el servidor.
# ─────────────────────────────────────────────

# ── Stage 1: build ───────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ── Stage 2: producción ──────────────────────
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Sin este archivo `prisma migrate deploy` aborta con «datasource.url property
# is required»: el schema no declara la URL, la pone la configuración del CLI.
COPY prisma.config.ts ./

# `prisma` está en dependencies, no en devDependencies: la imagen necesita el
# CLI para ejecutar `prisma migrate deploy` al arrancar.
RUN npm ci --omit=dev && npm cache clean --force

# Se regenera el cliente aquí en vez de copiar node_modules/.prisma desde el
# builder: el cliente generado tiene que corresponderse con los node_modules
# de ESTA imagen, no con los del build.
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# curl para el healthcheck de docker-compose
RUN apk add --no-cache curl

# La imagen de node ya trae el usuario `node`. Un proceso que solo lee su
# código y habla con PostgreSQL no tiene por qué ser root dentro del contenedor.
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
