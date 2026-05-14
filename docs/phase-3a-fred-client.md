# Phase 3a — FRED Client

Create the rate entities, run migrations, and build the FRED API client utility. At the end of this sub-phase, you can fetch live rates from the Federal Reserve and store them — no BullMQ yet, just the plumbing.

## Deliverables

- [x] `MortgageRate` TypeORM entity + migration
- [x] `RateCommentary` TypeORM entity (empty for now, used in 3c)
- [x] `fred.client.ts` — typed FRED API fetch utility
- [x] `RatesModule` bootstrap (service stub, module registered)
- [x] Dev endpoint `GET /rates/fetch-now` to trigger a live FRED fetch manually

---