# Phase 4 — Deploy (Human Engineer Guide)

Ship the frontend to Cloudflare Pages and the backend to the bare metal / VPS cluster via Nomad. Wire Vault secrets, Consul service discovery, and Traefik routing.

For help generating job specs, configs, scripts, and a filled-in test plan, see the [DevOps Agent Guide](phase-4-devops-agent.md).

## Deliverables

- [ ] Cloudflare Pages project configured, GitHub Actions pipeline deploying `apps/web`
- [ ] Dockerfiles for `apps/api` and `services/litellm`
- [ ] Nomad job specs for `api`, `litellm`, `redis`
- [ ] Vault secret path populated, Nomad Vault integration working
- [ ] Consul health checks passing for all services
- [ ] Traefik routing `api.largelanguage.mortgage` → NestJS
- [ ] CORS configured on NestJS to allow `https://largelanguage.mortgage`
- [ ] End-to-end smoke test from production domain

---

## Step 1 — Docker Images

### `docker/Dockerfile.api`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/api ./apps/api
RUN pnpm --filter api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/node_modules /root_node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### `docker/Dockerfile.web`

Only needed if you want to serve the static build from a container (optional — Cloudflare Pages handles it):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/web ./apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
```

---

## Step 2 — Cloudflare Pages (Frontend)

### Setup

1. Connect GitHub repo to Cloudflare Pages
2. Build settings:
   - Framework preset: None (manual)
   - Build command: `pnpm --filter web build`
   - Output directory: `apps/web/dist`
   - Root directory: `/` (monorepo root)
3. Environment variable: `VITE_API_URL=https://api.largelanguage.mortgage`
4. Custom domain: `largelanguage.mortgage` (apex) + `www.largelanguage.mortgage`

### GitHub Actions (`.github/workflows/deploy-web.yml`)

```yaml
name: Deploy Web
on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'package.json', 'pnpm-workspace.yaml']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web build
        env:
          VITE_API_URL: https://api.largelanguage.mortgage
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: largelanguage-mortgage
          directory: apps/web/dist
```

---

## Step 3 — Vault Setup

### Policy (`infra/vault/mortgage-policy.hcl`)

```hcl
path "secret/data/mortgage/api" {
  capabilities = ["read"]
}
```

### Populate secrets (one-time)

```bash
vault kv put secret/mortgage/api \
  ANTHROPIC_KEY="sk-ant-..." \
  OPENAI_KEY="sk-..." \
  DB_PASSWORD="..." \
  FRED_API_KEY="..." \
  REDIS_URL="redis://redis.service.consul:6379" \
  DATABASE_URL="postgresql://mortgage:PASSWORD@postgres.service.consul:5432/mortgage"
```

### Create Vault role for Nomad

```bash
vault write auth/token/roles/mortgage-api \
  allowed_policies="mortgage-policy" \
  period="24h"
```

---

## Step 4 — Nomad Job Specs

### `infra/nomad/redis.nomad`

```hcl
job "redis" {
  datacenters = ["dc1"]
  type = "service"

  group "redis" {
    network {
      port "redis" { static = 6379 }
    }

    service {
      name = "redis"
      port = "redis"
      check {
        type     = "tcp"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "redis" {
      driver = "docker"
      config {
        image = "redis:7-alpine"
        ports = ["redis"]
      }
      resources {
        cpu    = 200
        memory = 256
      }
    }
  }
}
```

### `infra/nomad/litellm.nomad`

```hcl
job "litellm" {
  datacenters = ["dc1"]
  type = "service"

  group "litellm" {
    network {
      port "http" { static = 4000 }
    }

    service {
      name = "litellm"
      port = "http"
      check {
        type     = "http"
        path     = "/health"
        interval = "15s"
        timeout  = "3s"
      }
    }

    vault {
      policies = ["mortgage-policy"]
    }

    task "litellm" {
      driver = "docker"
      config {
        image   = "ghcr.io/berriai/litellm:main-latest"
        ports   = ["http"]
        volumes = ["local/config.yaml:/app/config.yaml"]
        command = "--config"
        args    = ["/app/config.yaml", "--port", "4000"]
      }

      template {
        data        = file("../../services/litellm/config.yaml")
        destination = "local/config.yaml"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/mortgage/api" }}
ANTHROPIC_KEY={{ .Data.data.ANTHROPIC_KEY }}
OPENAI_KEY={{ .Data.data.OPENAI_KEY }}
{{ end }}
EOH
        destination = "secrets/env"
        env         = true
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
```

### `infra/nomad/api.nomad`

```hcl
job "mortgage-api" {
  datacenters = ["dc1"]
  type = "service"

  group "api" {
    count = 1

    network {
      port "http" { to = 3000 }
    }

    service {
      name = "mortgage-api"
      port = "http"
      tags = [
        "traefik.enable=true",
        "traefik.http.routers.mortgage-api.rule=Host(`api.largelanguage.mortgage`)",
        "traefik.http.routers.mortgage-api.tls.certresolver=letsencrypt",
      ]
      check {
        type     = "http"
        path     = "/health"
        interval = "15s"
        timeout  = "3s"
      }
    }

    vault {
      policies = ["mortgage-policy"]
    }

    task "api" {
      driver = "docker"
      config {
        image = "your-registry/largelanguage-mortgage-api:latest"
        ports = ["http"]
      }

      template {
        data = <<EOH
{{ with secret "secret/data/mortgage/api" }}
DATABASE_URL={{ .Data.data.DATABASE_URL }}
REDIS_URL={{ .Data.data.REDIS_URL }}
FRED_API_KEY={{ .Data.data.FRED_API_KEY }}
ANTHROPIC_KEY={{ .Data.data.ANTHROPIC_KEY }}
{{ end }}
LITELLM_URL=http://{{ range service "litellm" }}{{ .Address }}:{{ .Port }}{{ end }}
NODE_ENV=production
EOH
        destination = "secrets/env"
        env         = true
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
```

---

## Step 5 — Traefik Config

Traefik should already be running on your cluster with the Consul Catalog provider. The Nomad service tags in `api.nomad` are sufficient to configure routing automatically.

If you need a static config addition (`infra/traefik/dynamic.yaml`):

```yaml
# Usually not needed if Consul Catalog provider is active
# Traefik reads service tags from Consul automatically
```

Ensure Traefik has:
- `--providers.consulCatalog=true`
- `--providers.consulCatalog.endpoint=http://consul.service.consul:8500`
- `--certificatesResolvers.letsencrypt` configured for TLS

---

## Step 6 — CORS Configuration (NestJS)

In `apps/api/src/main.ts`:

```ts
app.enableCors({
  origin: [
    'https://largelanguage.mortgage',
    'https://www.largelanguage.mortgage',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : []),
  ],
  credentials: true,
})
```

---

## Step 7 — Run Migrations on Deploy

Add a migration step before starting the API container. Options:

**Option A** — pre-start script in the Nomad task:
```hcl
config {
  command = "/bin/sh"
  args = ["-c", "node dist/migration-runner.js && node dist/main.js"]
}
```

**Option B** — separate short-lived Nomad batch job that runs migrations, then the API job depends on it. Cleaner for zero-downtime deploys.

For MVP, Option A is sufficient.

---

## Step 8 — Seed Historical Rates

On first deploy, run the one-time seed script:

```bash
# From inside the running API container, or via a Nomad batch job
node dist/scripts/seed-rates.js
```

This backfills 3 years of weekly rate history from FRED.

---

## GitHub Actions — API Deploy (`.github/workflows/deploy-api.yml`)

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'docker/Dockerfile.api']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - name: Build Docker image
        run: |
          docker build -f docker/Dockerfile.api \
            -t your-registry/largelanguage-mortgage-api:${{ github.sha }} \
            -t your-registry/largelanguage-mortgage-api:latest .
      - name: Push image
        run: docker push your-registry/largelanguage-mortgage-api:latest
      - name: Deploy via Nomad
        run: |
          nomad job run infra/nomad/api.nomad
        env:
          NOMAD_ADDR: ${{ secrets.NOMAD_ADDR }}
          NOMAD_TOKEN: ${{ secrets.NOMAD_TOKEN }}
```

---

## Verification

```bash
# Health check via public domain
curl https://api.largelanguage.mortgage/health
# → { "status": "ok", "postgres": true, "redis": true }

# Rates
curl https://api.largelanguage.mortgage/rates/current
# → real rate data

# Chat session
curl -X POST https://api.largelanguage.mortgage/chat/session
# → { "sessionId": "uuid" }

# Frontend
# https://largelanguage.mortgage — landing page loads, rate snapshot shows real data
# /chat — streaming works end-to-end (check browser Network tab for SSE events)
# /calculator — all math correct, no API calls in Network tab
# /rates — chart renders, commentary appears
```

## Post-Launch Checklist

- [ ] Cloudflare proxy enabled on apex domain (orange cloud)
- [ ] SSL certificate issued (Let's Encrypt via Traefik, or Cloudflare origin cert)
- [ ] Rate limiting on `/chat/stream` (BullMQ or NestJS ThrottlerModule — prevent abuse)
- [ ] Error monitoring wired (Sentry free tier, or a self-hosted Glitchtip on Nomad)
- [ ] BullMQ dashboard enabled for job visibility (bull-board, secured behind basic auth)
- [ ] Nomad auto-restart policy set for all jobs (`restart { attempts = 3 }`)
- [ ] FRED API key usage monitored (free tier has limits)
