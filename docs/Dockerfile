# Keep esbuild's compiler behavior, but replace its vulnerable embedded Go runtime.
FROM golang:1.27.3-alpine3.24@sha256:b8c9b82affbbb82a020bbcf998dad2ba9516944ac7e883524642a481a9505e9c AS esbuild
WORKDIR /build
RUN go mod init gridfinity-esbuild \
    && go get github.com/evanw/esbuild@v0.25.12 golang.org/x/sys@v0.44.0 \
    && CGO_ENABLED=0 go build -o /out/esbuild github.com/evanw/esbuild/cmd/esbuild

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

# Apply compatible fixes to npm's bundled dependencies before installing inputs.
RUN npm install --global --ignore-scripts --no-audit --no-fund npm@11.21.1 \
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
FROM nginx:1.30.6-alpine3.24-slim@sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7 AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80
