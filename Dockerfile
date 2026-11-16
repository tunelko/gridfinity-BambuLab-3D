# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

# npm 11.21.1 still bundles affected undici/ip-address releases. Replace those
# packages with compatible patched releases before npm processes project inputs.
RUN apk add --no-cache zlib=1.4-r0 \
    && npm install --global --ignore-scripts --no-audit --no-fund npm@11.21.1 \
    && npm install --prefix /tmp/npm-security --ignore-scripts --no-audit --no-fund --package-lock=false undici@6.29.1 ip-address@10.7.4 \
    && rm -r /usr/local/lib/node_modules/npm/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && mv /tmp/npm-security/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici \
    && mv /tmp/npm-security/node_modules/ip-address /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && rm -r /tmp/npm-security

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve stage: static files only, no Node runtime ─────────────────────────
FROM nginx:1.30.6-alpine3.24-slim@sha256:e2355aa95529a7999dad94ddcb45a8768abf6fb0b204c93b1a3ffce477d7b893 AS runtime

# The pinned upstream image still contains zlib 1.3.2-r1 (CVE-2026-4738).
RUN apk add --no-cache zlib=1.4-r0

COPY deploy/nginx-app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Evicts stale dev-server service workers from clients (see file header)
COPY deploy/dev-sw-killswitch.js /usr/share/nginx/html/dev-sw.js

EXPOSE 80
