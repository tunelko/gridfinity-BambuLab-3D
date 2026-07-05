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
# Evicts stale dev-server service workers from clients (see file header)
COPY deploy/dev-sw-killswitch.js /usr/share/nginx/html/dev-sw.js

EXPOSE 80
