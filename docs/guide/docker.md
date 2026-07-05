# Docker Setup

Gridfinity Builder can be run entirely via Docker with no local Node.js installation required.

## Quick Start

```bash
git clone https://github.com/tunelko/gridfinity-BambuLab-3D.git
cd gridfinity-BambuLab-3D
docker compose build --no-cache
docker compose up -d
```

The app will be available at `http://localhost:5173`.

## How it works

Both services use **multi-stage builds**: a `node:24-alpine` stage compiles the static
site (`npm run build` / `vitepress build`), and an `nginx:alpine` stage serves the
resulting files. The running containers contain **no Node runtime, no source code and
no dev server** — only static assets behind nginx.

| Service | Host port | Serves |
|---------|-----------|--------|
| `app`   | 5173      | Vite production build (`dist/`) |
| `docs`  | 4173      | VitePress build (`.vitepress/dist/`) |

Deploying a change is always: rebuild image + restart container.

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose build --no-cache` | Rebuild the images (always use `--no-cache`) |
| `docker compose up -d` | Start in background |
| `docker compose logs --tail 30` | View recent logs |
| `docker compose down` | Stop the containers |

::: tip
Always use `--no-cache` when building to ensure all modified files are applied.
:::

## Local development

For hot-reload development, run Vite directly (outside Docker):

```bash
npm install
npm run dev
```

::: warning
Do not expose `npm run dev` to the internet. The Vite dev server serves project
files and is not hardened for public traffic — that is exactly what the nginx
production images exist for.
:::
