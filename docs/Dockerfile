# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /docs

COPY package.json ./
RUN npm install

COPY . .
RUN npx vitepress build

# ── Serve stage: static files only ───────────────────────────────────────────
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80
