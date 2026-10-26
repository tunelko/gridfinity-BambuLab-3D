# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

# npm 11.21.1 still bundles affected undici/ip-address releases. Replace those
# packages with compatible patched releases before npm processes project inputs.
RUN npm install --global --ignore-scripts --no-audit --no-fund npm@11.21.1 \
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
FROM nginx:1.30.6-alpine3.24-slim@sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7 AS runtime

COPY deploy/nginx-app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Evicts stale dev-server service workers from clients (see file header)
COPY deploy/dev-sw-killswitch.js /usr/share/nginx/html/dev-sw.js

EXPOSE 80
