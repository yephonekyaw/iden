# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:25-alpine3.22 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Injected at build time by docker-compose (defaults to /api/v1 for production)
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.30-alpine3.23-slim

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
