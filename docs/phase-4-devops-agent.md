# Phase 4 — DevOps Agent Guide

This document is for a DevOps LLM agent assisting a human engineer with the production deployment. The human engineer makes all final decisions and runs all commands. The agent's role is to generate, review, and validate job specs, configs, scripts, and the test plan.

The human deploy guide is in [phase-4-deploy.md](phase-4-deploy.md).

---

## Agent Scope

The agent should be able to help with all of the following on request. Ask for the specific task — do not generate all artifacts upfront.

---

## 1. Nomad Job Specs

### Context the agent needs before generating specs

Before writing any `.nomad` file, ask the engineer:
- What datacenter name is configured? (default in examples: `dc1`)
- Is Postgres managed externally or running as a Nomad job?
- What Docker registry is used? (e.g. GHCR, Docker Hub, private registry)
- What Nomad driver is available? (`docker` assumed — confirm)
- Is Consul ACL enabled? If so, what token scope is available?
- What resource constraints apply (CPU MHz, memory MB) per service?

### Jobs to generate

| Job file | Service | Key concerns |
|---|---|---|
| `infra/nomad/api.nomad` | NestJS API | Vault integration, Consul service tags for Traefik, rolling restart policy |
| `infra/nomad/litellm.nomad` | LiteLLM proxy | Config file mount via template stanza, Vault secrets for API keys |
| `infra/nomad/redis.nomad` | Redis | Persistent volume for AOF/RDB, or ephemeral if acceptable |
| `infra/nomad/migrate.nomad` | DB migration batch job | `type = "batch"`, runs before API job on deploy |

### Nomad template patterns to use

**Vault secret injection:**
```hcl
vault {
  policies = ["mortgage-policy"]
}
template {
  data = <<EOH
{{ with secret "secret/data/mortgage/api" }}
DATABASE_URL={{ .Data.data.DATABASE_URL }}
FRED_API_KEY={{ .Data.data.FRED_API_KEY }}
{{ end }}
EOH
  destination = "secrets/env"
  env         = true
}
```

**Consul service discovery (for LiteLLM URL):**
```hcl
LITELLM_URL=http://{{ range service "litellm" }}{{ .Address }}:{{ .Port }}{{ end }}
```

**Traefik routing via Consul tags:**
```hcl
service {
  tags = [
    "traefik.enable=true",
    "traefik.http.routers.mortgage-api.rule=Host(`api.largelanguage.mortgage`)",
    "traefik.http.routers.mortgage-api.tls.certresolver=letsencrypt",
  ]
}
```

**Rolling restart (zero-downtime):**
```hcl
update {
  max_parallel     = 1
  min_healthy_time = "30s"
  healthy_deadline = "5m"
  auto_revert      = true
}
```

---

## 2. Vault Setup Scripts

### Agent tasks

- Generate `infra/vault/mortgage-policy.hcl` — policy granting `read` on `secret/data/mortgage/api`
- Generate `infra/vault/setup.sh` — idempotent shell script that:
  1. Enables KV v2 secrets engine at `secret/`
  2. Writes the policy
  3. Creates a Nomad token role
  4. Prints the next steps for the engineer (manually set secret values)
- Generate `infra/vault/secrets-template.sh` — shows the `vault kv put` command with placeholder values so the engineer can fill in and run it

### What the agent must NOT do

- Never generate or suggest actual secret values
- Never write secrets to any file that could be committed
- Always instruct the engineer to run `vault kv put` interactively

---

## 3. Traefik Configuration

### Agent tasks

- Review the Nomad service tags in `api.nomad` and confirm they are correct for the running Traefik version
- Generate `infra/traefik/traefik.yml` (static config) if not already present:
  - Consul Catalog provider
  - Let's Encrypt resolver (HTTP challenge or TLS-ALPN)
  - Dashboard config (secured)
- Generate `infra/traefik/dynamic.yml` if any static routing rules are needed outside Consul tags

### Key questions to ask the engineer

- What Traefik version is running?
- Is the Let's Encrypt resolver already configured globally, or does this service need its own?
- Is there an existing Traefik static config to extend, or is this a fresh install?
- What challenge type for TLS? (`http` requires port 80 open; `tlsChallenge` requires 443)

---

## 4. CI/CD Pipeline

### Files to generate

- `.github/workflows/deploy-web.yml` — Cloudflare Pages deploy on push to `main` (paths: `apps/web/**`)
- `.github/workflows/deploy-api.yml` — Docker build → push to registry → `nomad job run` on push to `main` (paths: `apps/api/**`)
- `.github/workflows/test.yml` — lint + typecheck on PRs

### Agent tasks

- Generate the workflow files with appropriate path filters, caching, and secrets references
- Confirm which secrets are needed in GitHub Actions (`CF_API_TOKEN`, `CF_ACCOUNT_ID`, `NOMAD_ADDR`, `NOMAD_TOKEN`, Docker registry credentials)
- If the engineer uses a different CI system (GitLab CI, Drone, etc.), adapt accordingly

### Docker build considerations

- The monorepo build context must be the repo root (not `apps/api/`) — the Dockerfile uses workspace dependencies
- Cache `node_modules` via Docker layer caching or GitHub Actions cache
- Tag images with both `git sha` and `latest`

---

## 5. Test Plan

The human engineer runs this test plan after each deploy step. The agent should generate a filled-in version based on the actual domain, IPs, and service names.

### Pre-deploy checks

```bash
# All Nomad jobs planned (dry run)
nomad job plan infra/nomad/redis.nomad
nomad job plan infra/nomad/litellm.nomad
nomad job plan infra/nomad/migrate.nomad
nomad job plan infra/nomad/api.nomad

# Vault secrets readable
vault kv get secret/mortgage/api
```

### Deploy order

```
1. redis.nomad
2. litellm.nomad
3. migrate.nomad (batch — wait for completion)
4. api.nomad
5. Cloudflare Pages (automatic via GitHub Actions)
```

### Post-deploy smoke tests

```bash
# 1. Service health via Consul
consul health node <node-name>

# 2. API health via public domain
curl https://api.largelanguage.mortgage/health
# Expected: { "status": "ok", "postgres": true, "redis": true }

# 3. Rates endpoint
curl https://api.largelanguage.mortgage/rates/current
# Expected: JSON with 30yr_fixed, 15yr_fixed, 5_1_arm rate data

# 4. Chat session
curl -X POST https://api.largelanguage.mortgage/chat/session
# Expected: { "sessionId": "<uuid>" }

# 5. Chat stream (replace <uuid>)
curl "https://api.largelanguage.mortgage/chat/stream?sessionId=<uuid>&message=What+is+PMI" \
  -H 'Accept: text/event-stream'
# Expected: SSE chunks, ends with data: {"done":true}

# 6. Waitlist
curl -X POST https://api.largelanguage.mortgage/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"email":"deploy-test@example.com","source":"smoke-test"}'
# Expected: 201

# 7. Frontend (manual browser checks)
# https://largelanguage.mortgage       → landing loads, rate snapshot populated
# https://largelanguage.mortgage/chat  → can send a message, streaming works
# https://largelanguage.mortgage/rates → chart renders, commentary visible
# https://largelanguage.mortgage/calculator → calculator reactive, no API calls
```

### Rollback plan

```bash
# API: revert to previous image tag
nomad job revert mortgage-api <previous-version>

# Frontend: Cloudflare Pages → Deployments → rollback to previous deployment (one click)

# DB migrations: no automatic rollback — engineer must write and run a down migration manually
# Before running up migrations on prod, always pg_dump first:
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

---

## 6. Monitoring & Alerting Stubs

The agent can generate configs for these — ask for whichever is needed:

- **Bull-board** — secured behind HTTP basic auth for prod
- **Nomad resource alerts** — Nomad sentinel policy or external monitor for OOM/restart loops
- **Uptime check** — simple cron job hitting `/health` and alerting via email/webhook
- **FRED API failure alert** — BullMQ `failed` event handler that sends a notification if `fetch-rates` fails (Freddie Mac publish delays do happen)

---

## How to Use This Document with an Agent

Paste the relevant section into the agent's context along with:
1. The current state of the file being generated or reviewed
2. Answers to the "questions to ask" listed in each section
3. Any constraints specific to your cluster (Nomad version, Traefik version, etc.)

The agent should generate the artifact, explain any non-obvious choices, and flag anything that requires the engineer's manual action (secrets, DNS, TLS certs).
