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

## Configuration

The `docker-compose.yml` mounts source files as volumes for hot-reload during development:

```yaml
volumes:
  - ./src:/app/src
  - ./public:/app/public
  - ./index.html:/app/index.html
  - ./vite.config.ts:/app/vite.config.ts
  - ./tailwind.config.ts:/app/tailwind.config.ts
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose build --no-cache` | Rebuild the container (always use `--no-cache`) |
| `docker compose up -d` | Start in background |
| `docker compose logs --tail 30` | View recent logs |
| `docker compose down` | Stop the container |

::: tip
Always use `--no-cache` when building to ensure all modified files are applied.
:::

## Production Deployment

For production, build the static assets and serve with nginx or Cloudflare Pages:

```bash
docker compose exec app npm run build
```

The `dist/` folder contains the complete static site.
