# largelanguage.mortgage

An independent, buyer-first AI mortgage advisor. No lender affiliation. No conflict of interest. The mortgage AI that works for you, not the bank.

## Why This Exists

Every consumer-facing mortgage AI tool (Better.com's Betsy, lender chatbots) is owned by a lender — built to sell you their product. There is no neutral, intelligent, conversational AI that explains your specific situation honestly, including when renting might be the better choice. This is that tool.

## Features (MVP)

- **AI Mortgage Advisor** — Conversational AI that answers any mortgage question in plain English. Streaming, session-based, no login required. Supports Claude, GPT-4o, local models, and BYOK.
- **Local LLM Support** — Connect to your own Ollama or vLLM deployments with custom model names and endpoints.
- **Scenario Calculator** — Side-by-side mortgage scenario comparison, amortization schedules, points break-even, rent vs buy. Runs entirely client-side, zero latency.
- **Live Rate Tracker** — Weekly FRED/Freddie Mac rates with AI-generated plain-English commentary on what moved and why.
- **Waitlist** — Email capture for the owned audience (newsletter, future features).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite → static build → Cloudflare Pages |
| Backend | NestJS + TypeScript + TypeORM + Postgres + Redis + BullMQ |
| AI routing | LiteLLM proxy (Claude, OpenAI, Ollama, BYOK) |
| Infra (prod) | Nomad + Consul + Vault + Traefik |
| Monorepo | pnpm workspaces |

## Project Structure

```
largelanguage.mortgage/
├── apps/
│   ├── web/                  # Vue 3 + Vite frontend (Cloudflare Pages)
│   └── api/                  # NestJS backend
├── services/
│   └── litellm/              # LiteLLM proxy config
├── infra/
│   ├── nomad/                # Nomad job specs
│   ├── consul/               # Service mesh config
│   ├── vault/                # Secret policies
│   └── traefik/              # Routing rules
├── docker/                   # Dockerfiles for prod images
├── docs/                     # Phase implementation guides
├── docker-compose.yml        # Local dev services
├── .env.example              # Required environment variables
├── CLAUDE.md                 # AI agent instructions
└── package.json              # pnpm workspace root
```

## Local Dev Quickstart

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone <repo>
cd largelanguage.mortgage
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — add ANTHROPIC_KEY (minimum), FRED_API_KEY
```

### 3. Start backing services

```bash
docker-compose up -d
# Starts: Postgres (5432), Redis (6379), LiteLLM proxy (4000)
```

### 4. Run apps

```bash
# Two terminals:
pnpm --filter api dev     # NestJS on :3000
pnpm --filter web dev     # Vite on :5173
```

### 5. Verify

```bash
curl http://localhost:3000/health
# → { "status": "ok", "postgres": true, "redis": true }
```

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

## Implementation Phases

| Phase | Doc | Sub-phases |
|---|---|---|
| 1 — Foundation | [phase-1-foundation.md](docs/phase-1-foundation.md) | Monorepo, docker-compose, NestJS + Vue bootstrap |
| 2 — Core Features | [phase-2-core-features.md](docs/phase-2-core-features.md) | [2a Waitlist](docs/phase-2a-waitlist.md) · [2b Calculator](docs/phase-2b-calculator.md) · [2c LLM](docs/phase-2c-llm.md) · [2d Chat](docs/phase-2d-chat.md) |
| 3 — Rate Tracker | [phase-3-rate-tracker.md](docs/phase-3-rate-tracker.md) | [3a FRED Client](docs/phase-3a-fred-client.md) · [3b BullMQ Jobs](docs/phase-3b-bullmq-jobs.md) · [3c Commentary](docs/phase-3c-commentary.md) · [3d Rates View](docs/phase-3d-rates-view.md) |
| 4 — Deploy | [phase-4-deploy.md](docs/phase-4-deploy.md) | Human engineer guide · [DevOps Agent Guide](docs/phase-4-devops-agent.md) |

## Using Local LLMs (Ollama/vLLM)

The application now supports connecting to your own Ollama or vLLM deployments. 

### How to Use:

1. Select "Local (Ollama)" from the model dropdown
2. Enter your model name (e.g., "llama3", "mistral", "gemma")
3. Enter your Ollama/vLLM endpoint URL (default: `http://localhost:11434`)

### Configuration Details:

The system uses LiteLLM's built-in support for Ollama models. Your custom configuration will be passed through to LiteLLM, which will route requests to your local deployment.

### Local Development Setup:

If you're running Ollama locally, make sure:
- Ollama is running on your machine
- The endpoint is accessible from the Docker container (use `host.docker.internal` for local development)
- Your models are pulled and available on the Ollama instance

## Data Sources

- **Mortgage rates**: [FRED API](https://fred.stlouisfed.org) — `MORTGAGE30US`, `MORTGAGE15US`, `MORTGAGE5US` series (Freddie Mac PMMS, published weekly on Thursdays). Free, no scraping.

## License

Private / proprietary.
