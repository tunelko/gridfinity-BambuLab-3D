# Keep esbuild's compiler behavior, but replace its vulnerable embedded Go runtime.
FROM golang:1.27.4-alpine3.24@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS esbuild
WORKDIR /build
RUN apk add --no-cache zlib=1.4-r0 \
    && go mod init gridfinity-esbuild \
    && go get github.com/evanw/esbuild@v0.25.12 golang.org/x/sys@v0.44.0 \
    && CGO_ENABLED=0 go build -o /out/esbuild github.com/evanw/esbuild/cmd/esbuild

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

# Apply compatible fixes to npm's bundled dependencies before installing inputs.
RUN apk add --no-cache zlib=1.4-r0 \
    && npm install --global --ignore-scripts --no-audit --no-fund npm@11.21.1 \
    && npm install --prefix /tmp/npm-security --ignore-scripts --no-audit --no-fund --package-lock=false undici@6.29.1 ip-address@10.7.4 \
    && rm -r /usr/local/lib/node_modules/npm/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && mv /tmp/npm-security/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici \
    && mv /tmp/npm-security/node_modules/ip-address /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && rm -r /tmp/npm-security

WORKDIR /docs

COPY package.json package-lock.json ./
RUN npm ci

COPY --from=esbuild /out/esbuild /tmp/esbuild
RUN install -m 755 /tmp/esbuild "node_modules/@esbuild/linux-$(node -p 'process.arch')/bin/esbuild" \
    && install -m 755 /tmp/esbuild node_modules/esbuild/bin/esbuild \
    && rm /tmp/esbuild \
    && test "$(node_modules/.bin/esbuild --version)" = "0.25.12"

COPY . .
RUN npx vitepress build

# ── Serve stage: static files only ───────────────────────────────────────────
FROM nginx:1.30.6-alpine3.24-slim@sha256:e2355aa95529a7999dad94ddcb45a8768abf6fb0b204c93b1a3ffce477d7b893 AS runtime

# The pinned upstream image still contains zlib 1.3.2-r1 (CVE-2026-4738).
RUN apk add --no-cache zlib=1.4-r0

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80
