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

Both services use **multi-stage builds**: Node 24.22.1 on Alpine 3.24 compiles the static
site (`npm run build` / `vitepress build`), and Nginx 1.30.6 on Alpine 3.24 (slim) serves the
resulting files. The running containers contain **no Node runtime, no source code and
no dev server** — only static assets behind nginx.

Both base images are pinned by digest in the Dockerfiles. Updating a base image requires
changing that pin, rebuilding, and verifying the new image; rebuilding an unchanged pin
does not fetch a newer security release.

The docs build also compiles its existing esbuild version with a pinned Go 1.27.3
toolchain to replace the outdated Go runtime in the upstream binary. This compiler
stage is not included in the production image. Use Docker for this remediated docs
toolchain; a host-side npm install still downloads the upstream esbuild binary.

| Service | Host port | Serves |
|---------|-----------|--------|
| `app`   | 5173      | Vite production build (`dist/`) |
| `docs`  | 4173      | VitePress build (`.vitepress/dist/`) |

To deploy changed source, rebuild the relevant image and recreate its container. GitHub
workflows test the application and scan the repository plus both stages of each Docker
image. They do not deploy or publish those images. See the
[dependency verification record](../architecture/dependency-validation.md) for security thresholds.

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose build app docs` | Rebuild the two project images; this Compose file already sets `no_cache: true` |
| `docker compose up -d` | Start in background |
| `docker compose logs --tail 30` | View recent logs |
| `docker compose down` | Stop the containers |

The repository deliberately disables build caching in Compose. This is a project setting, not a general requirement for Docker to pick up changed source files.

## Local development

For hot-reload development, run Vite directly (outside Docker):

```bash
nvm use
npm ci
npm run dev
```

`nvm use` selects the patched Node version in `.nvmrc`; if you use another Node version
manager, select that same release before installing dependencies.

::: warning
Do not expose `npm run dev` to the internet. The Vite dev server serves project
files and is not hardened for public traffic — that is exactly what the nginx
production images exist for.
:::
