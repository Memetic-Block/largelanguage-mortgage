# Phase 1 — Foundation

Scaffold the monorepo, wire up backing services locally, and get both apps running with a health check. No features yet — just a solid, runnable base.

## Deliverables

- [ ] pnpm workspace monorepo initialized
- [ ] `docker-compose.yml` with Postgres, Redis, LiteLLM
- [ ] `.env.example` with all required variables
- [ ] NestJS app booted, connected to Postgres + Redis, `/health` returns 200
- [ ] Vue app booted on Vite with router, Pinia, Tailwind configured
- [ ] Stub Nomad job specs and Vault policy files (prod, not needed for dev)
- [ ] `git init` + `.gitignore` committed

---

## Step 1 — Monorepo Scaffold

### `package.json` (root)

```json
{
  "name": "largelanguage-mortgage",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
```

### `.gitignore`

```
node_modules/
dist/
.env.local
*.env.local
```

---

## Step 2 — NestJS App (`apps/api`)

Bootstrap with NestJS CLI:

```bash
cd apps
npx @nestjs/cli new api --package-manager pnpm --skip-git
```

### Required packages

```bash
cd api
pnpm add @nestjs/typeorm typeorm pg @nestjs/config
pnpm add @nestjs/bull bull ioredis
pnpm add class-validator class-transformer
pnpm add uuid
pnpm add -D @types/pg @types/uuid
```

### `apps/api/src/app.module.ts`

Configure:
- `ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env.local' })`
- `TypeOrmModule.forRootAsync(...)` — reads `DATABASE_URL` from ConfigService
- `BullModule.forRootAsync(...)` — reads `REDIS_URL` from ConfigService

### `apps/api/src/health/health.controller.ts`

`GET /health` — queries `SELECT 1` on Postgres and `PING` on Redis. Returns:

```json
{ "status": "ok", "postgres": true, "redis": true }
```

### TypeORM config

Use `DATABASE_URL` env var. Enable `synchronize: false` (use migrations). `autoLoadEntities: true`.

---

## Step 3 — Vue App (`apps/web`)

Scaffold with Vite:

```bash
cd apps
pnpm create vite web --template vue-ts
```

### Required packages

```bash
cd web
pnpm add vue-router@4 pinia @vueuse/core
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Router (`src/router/index.ts`)

```ts
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../views/LandingView.vue') },
  { path: '/chat', component: () => import('../views/ChatView.vue') },
  { path: '/calculator', component: () => import('../views/CalculatorView.vue') },
  { path: '/rates', component: () => import('../views/RatesView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
```

### Pinia (`src/stores/`)

Create stub stores:
- `chat.ts` — `useChatStore()`
- `rates.ts` — `useRatesStore()`

### Tailwind (`tailwind.config.js`)

```js
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: { extend: {} },
  plugins: [],
}
```

### Vite config (`vite.config.ts`)

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

Create stub views: `LandingView.vue`, `ChatView.vue`, `CalculatorView.vue`, `RatesView.vue` — each just a `<h1>` placeholder.

---

## Step 4 — docker-compose.yml

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mortgage
      POSTGRES_USER: mortgage
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-devpassword}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports:
      - '4000:4000'
    volumes:
      - ./services/litellm/config.yaml:/app/config.yaml
    command: --config /app/config.yaml --port 4000
    environment:
      ANTHROPIC_KEY: ${ANTHROPIC_KEY}
      OPENAI_KEY: ${OPENAI_KEY:-}
    depends_on:
      - redis

volumes:
  postgres_data:
```

---

## Step 5 — `.env.example`

```bash
# Postgres
DATABASE_URL=postgresql://mortgage:devpassword@localhost:5432/mortgage

# Redis
REDIS_URL=redis://localhost:6379

# LiteLLM proxy
LITELLM_URL=http://localhost:4000

# AI providers (for LiteLLM — set at least one)
ANTHROPIC_KEY=
OPENAI_KEY=

# FRED (Federal Reserve) API — free at fred.stlouisfed.org
FRED_API_KEY=

# Frontend
VITE_API_URL=http://localhost:3000
```

---

## Step 6 — LiteLLM Config Stub (`services/litellm/config.yaml`)

```yaml
model_list:
  - model_name: mortgage-advisor
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_KEY

  - model_name: mortgage-advisor-oai
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_KEY

  - model_name: mortgage-advisor-local
    litellm_params:
      model: ollama/llama3
      api_base: http://host.docker.internal:11434

general_settings:
  allow_user_auth: true
```

---

## Step 7 — Nomad + Vault Stubs (`infra/`)

Create stub files — these are not needed for local dev but establish the prod structure:

```
infra/
  nomad/
    api.nomad          # NestJS job spec stub
    litellm.nomad      # LiteLLM job spec stub
    redis.nomad        # Redis job spec stub
  vault/
    mortgage-policy.hcl  # Vault policy: read secret/mortgage/api/*
  traefik/
    dynamic.yaml         # Traefik routing rules stub
```

See [Phase 4 — Deploy](phase-4-deploy.md) for full contents.

---

## Step 8 — First Migrations

Create initial TypeORM migration covering all 5 tables:

```
conversations, messages, mortgage_rates, rate_commentary, waitlist
```

```bash
pnpm --filter api migration:generate -- src/migrations/InitialSchema
pnpm --filter api migration:run
```

---

## Verification

```bash
docker-compose up -d
pnpm install
pnpm --filter api dev &
pnpm --filter web dev &

curl http://localhost:3000/health
# { "status": "ok", "postgres": true, "redis": true }

# Browser: http://localhost:5173 — shows stub landing page, router navigates to /chat etc.
```

Phase 1 is complete when both apps run, the health check passes, and all 4 routes render without errors.

---

Next: [Phase 2 — Core Features](phase-2-core-features.md)
