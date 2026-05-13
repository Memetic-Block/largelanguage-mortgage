# Phase 3 — Rate Tracker (Index)

Four sub-phases building the FRED data pipeline end-to-end. Must be built in order — each sub-phase depends on the previous.

## Dependency order

```
3a (FRED Client + Entities) → 3b (BullMQ Jobs) → 3c (Commentary) → 3d (Rates View)
```

## Sub-phases

| Sub-phase | Feature | Deliverable |
|---|---|---|
| [3a](phase-3a-fred-client.md) | FRED Client | Rate entities, migrations, FRED API client, `RatesModule` bootstrap |
| [3b](phase-3b-bullmq-jobs.md) | BullMQ Jobs | `fetch-rates` job, weekly scheduler, Redis cache, historical seed script |
| [3c](phase-3c-commentary.md) | Rate Commentary | `generate-commentary` job, prompt builder, `RateCommentary` entity |
| [3d](phase-3d-rates-view.md) | Rates View | `RatesService`, controller endpoints, `useRates`, `RatesView`, landing snapshot |

## Phase 3 complete when

- [ ] `GET /rates/current` returns real Freddie Mac data
- [ ] `GET /rates/history?weeks=52` returns 52 weeks from Postgres
- [ ] `GET /rates/commentary` returns AI-generated commentary
- [ ] Weekly BullMQ cron registered and visible in bull-board
- [ ] Rates view renders chart, commentary, and all three current rates
- [ ] Landing page rate snapshot shows live 30yr fixed rate
- [ ] "What does this mean for me?" CTA opens `/chat` with pre-seeded message
