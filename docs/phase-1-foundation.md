# Phase 1 — Foundation

Scaffold the monorepo, wire up backing services locally, and get both apps running with a health check. No features yet — just a solid, runnable base.

## Deliverables

- [x] pnpm workspace monorepo initialized
- [x] `docker-compose.yml` with Postgres, Redis, LiteLLM
- [x] `.env.example` with all required variables
- [x] NestJS app booted, connected to Postgres + Redis, `/health` returns 200
- [x] Vue app booted on Vite with router, Pinia, Tailwind configured
- [x] Stub Nomad job specs and Vault policy files (prod, not needed for dev)
- [x] `git init` + `.gitignore` committed

---