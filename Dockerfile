# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve stage: static files only, no Node runtime ─────────────────────────
FROM nginx:1.27-alpine

COPY deploy/nginx-app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
