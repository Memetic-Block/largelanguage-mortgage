# Agent Instructions — largelanguage.mortgage

## Project Overview

pnpm monorepo. Two apps: `apps/web` (Vue 3 + Vite) and `apps/api` (NestJS). Backing services (Postgres, Redis, LiteLLM) run in docker-compose locally and via Nomad in prod. Secrets come from Vault in prod, `.env.local` in dev.

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Running Locally

1. Start backing services:
```bash
docker-compose up -d
```

2. Run apps in two terminals:
```bash
pnpm --filter api dev     # NestJS on :3000
pnpm --filter web dev     # Vite on :5173
```

Health check:
```bash
curl http://localhost:3000/health
# → { "status": "ok", "postgres": true, "redis": true }
```

### Key Commands
- Run migrations: `pnpm --filter api migration:run`
- Generate migration: `pnpm --filter api migration:generate -- src/migrations/MigrationName`

## Stack Conventions

### Frontend (`apps/web`)
- Vue 3 **Composition API only** — never use Options API (`defineComponent({...})` object form)
- `<script setup lang="ts">` in every component — no `export default`
- Pinia for all shared state — no Vuex, no prop-drilling for cross-component state
- Vue Router 4 — use `useRouter()` / `useRoute()` composables
- Tailwind CSS — utility classes only, no custom CSS unless unavoidable
- Composables: `use` prefix, one concern per file (e.g. `useChat.ts`, `useRates.ts`)
- No `any` types — use `unknown` and narrow, or define proper interfaces

**File naming:**
- Components: `PascalCase.vue` (e.g. `ChatMessage.vue`)
- Views: `PascalCase.vue` in `src/views/` (e.g. `ChatView.vue`)
- Composables: `camelCase.ts` with `use` prefix in `src/composables/`
- Stores: `camelCase.ts` in `src/stores/` (e.g. `chat.ts` → `useChatStore()`)
- Everything else: `kebab-case.ts`

### Backend (`apps/api`)
- NestJS modules pattern — every feature is a module with `module.ts`, `controller.ts`, `service.ts`
- TypeORM for all DB access — no raw SQL, use `QueryBuilder` for complex queries
- Entities in `src/<module>/<module>.entity.ts`
- DTOs for all request/response bodies with `class-validator` decorators
- Never use `any` — type all service return values and DTO fields
- Use `@nestjs/config` `ConfigService` for all env var access — never `process.env` directly
- Secrets in prod come from Vault via Nomad env injection — same `ConfigService` interface

**Module structure:**
```
src/
  chat/
    chat.module.ts
    chat.controller.ts
    chat.service.ts
    entities/
      conversation.entity.ts
      message.entity.ts
    dto/
      create-session.dto.ts
      stream-message.dto.ts
```

### LiteLLM Proxy
- All LLM calls go through LiteLLM at `LITELLM_URL` — never call Anthropic/OpenAI APIs directly from the NestJS app
- Model alias `mortgage-advisor` is the default; frontend can pass `X-LLM-Model` header to select another
- BYOK: user's own API key arrives as `X-API-Key` header — pass it through to LiteLLM unchanged; LiteLLM handles the auth swap
- To add a new model: edit `services/litellm/config.yaml`, add to the `model_list`, restart the LiteLLM container
- LiteLLM config: `services/litellm/config.yaml`

### Streaming Pattern (Chat)
- NestJS: `@Sse('/chat/stream')` decorator returns `Observable<MessageEvent>`
- LlmService calls LiteLLM with `stream: true`, pipes the response as an async generator
- Vue: `useChat.ts` composable opens an `EventSource`, appends chunks to a reactive ref
- Do not buffer the full response before sending — stream chunks as they arrive

### Calculator
- All mortgage math lives in `apps/web/src/composables/useCalculator.ts`
- No API calls — pure TypeScript arithmetic, runs client-side
- Functions to implement: `amortize()`, `compareScenarios()`, `breakEvenPoints()`, `rentVsBuy()`
- Input/output types fully defined in `apps/web/src/types/calculator.ts`

## What NOT To Do

- Do not use Vue Options API
- Do not use `any` types anywhere
- Do not write raw SQL — use TypeORM `QueryBuilder` or the repository pattern
- Do not call Anthropic/OpenAI APIs directly — always go through LiteLLM
- Do not commit `.env.local` or any file containing secrets
- Do not add `console.log` to production code — use NestJS `Logger` in the API
- Do not store BYOK API keys in the database or server-side — they live in `localStorage` only and are sent as a header per request
- Do not use `var` — `const` by default, `let` only when reassignment is needed

## Running Locally

```bash
docker-compose up -d          # start Postgres, Redis, LiteLLM
pnpm --filter api dev         # NestJS on :3000
pnpm --filter web dev         # Vite on :5173
```

Health check: `curl http://localhost:3000/health`

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Postgres + Redis status |
| POST | `/chat/session` | Create conversation session |
| GET | `/chat/stream?sessionId=&message=` | SSE stream |
| GET | `/chat/:sessionId/history` | Message history |
| GET | `/rates/current` | Current rates (Redis cache → FRED fallback) |
| GET | `/rates/history?weeks=52` | Historical weekly rates |
| GET | `/rates/commentary` | Latest AI rate commentary |
| POST | `/waitlist` | Add email to waitlist |
| GET | `/waitlist/count` | Public subscriber count |

## Database

Postgres via TypeORM. Migrations live in `apps/api/src/migrations/`. Run migrations:

```bash
pnpm --filter api migration:run
```

Generate a migration after entity changes:

```bash
pnpm --filter api migration:generate -- src/migrations/MigrationName
```

## Database

Postgres via TypeORM. Migrations live in `apps/api/src/migrations/`. Run migrations:

```bash
pnpm --filter api migration:run
```

Generate a migration after entity changes:

```bash
pnpm --filter api migration:generate -- src/migrations/MigrationName
```

## Infra (Prod Only)

- Nomad job specs: `infra/nomad/*.nomad`
- Vault secret path: `secret/mortgage/api` — keys: `ANTHROPIC_KEY`, `OPENAI_KEY`, `DB_PASSWORD`, `FRED_API_KEY`, `REDIS_URL`
- Traefik routes: `api.largelanguage.mortgage` → `mortgage-api` Consul service
- Frontend: Cloudflare Pages — `pnpm --filter web build` output dir `apps/web/dist`

## Environment Variables

See `.env.example` for the full list. Minimum for local dev:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `LITELLM_URL` | LiteLLM proxy URL (default: `http://localhost:4000`) |
| `ANTHROPIC_KEY` | Anthropic API key (for LiteLLM) |
| `FRED_API_KEY` | Federal Reserve FRED API key (free at fred.stlouisfed.org) |

In prod, all secrets come from Vault — see `infra/vault/`.

## Phase Docs

Detailed step-by-step implementation guides:
- [Phase 1 — Foundation](docs/phase-1-foundation.md)
- [Phase 2 — Core Features](docs/phase-2-core-features.md)
- [Phase 3 — Rate Tracker](docs/phase-3-rate-tracker.md)
- [Phase 4 — Deploy](docs/phase-4-deploy.md)

## Data Sources

- **Mortgage rates**: [FRED API](https://fred.stlouisfed.org) — `MORTGAGE30US`, `MORTGAGE15US`, `MORTGAGE5US` series (Freddie Mac PMMS, published weekly on Thursdays). Free, no scraping.
