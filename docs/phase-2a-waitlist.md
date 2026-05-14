# Phase 2a — Waitlist

Build the `WaitlistModule` (API) and the landing page with working email capture (frontend). The landing page is a placeholder for the full hero — it just needs to be presentable and capture emails.

## Deliverables

- [x] `Waitlist` TypeORM entity + migration
- [x] `CreateWaitlistDto` with email validation
- [x] `WaitlistService` — insert (idempotent on duplicate) + count
- [x] `WaitlistController` — `POST /waitlist`, `GET /waitlist/count`
- [x] `useWaitlist.ts` composable
- [x] `LandingView.vue` — hero, value prop, email form, feature cards, footer

---