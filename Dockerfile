# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Gestión Logística y Flota — imagen de producción (un solo servicio).
#
# El SPA de React se compila y queda servido por el mismo Express que expone
# la API, así frontend y backend comparten origen: no hace falta CORS y la
# cookie httpOnly de refresh sigue siendo de primera parte (SameSite=strict).
# ---------------------------------------------------------------------------

# ---- 1. Build del frontend --------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Ruta relativa: el SPA pega contra la API del mismo dominio.
ARG VITE_API_URL=/api/v1
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

# ---- 2. Build del backend ---------------------------------------------------
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
# postinstall corre `prisma generate` -> src/generated/prisma (lo compila tsc).
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- 3. Runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true
ENV STATIC_DIR=public
ENV TRUST_PROXY=1

# node_modules se copia entero (incluye el CLI de Prisma) para poder correr
# `prisma migrate deploy` al arrancar sin descargar nada en runtime.
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package.json ./package.json
COPY --from=backend-build /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

# Adjuntos de choferes/mantenimientos (montar un volumen acá en Railway).
RUN mkdir -p uploads && chown -R node:node /app/uploads
USER node

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
