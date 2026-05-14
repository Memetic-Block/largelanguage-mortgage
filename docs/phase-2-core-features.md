# Phase 2 — Core Features (Index)

Four independent features, each in its own sub-phase. They can be built in order or in parallel across branches — there are no hard dependencies between 2b, 2c until 2d (Chat) needs LlmModule from 2c.

## Dependency order

```
2a (Waitlist) ─── independent
2b (Calculator) ── independent
2c (LlmModule) ─── must complete before 2d
2d (Chat) ──────── requires 2c
```

## Sub-phases

| Sub-phase | Feature | Deliverable |
|---|---|---|
| [2a](phase-2a-waitlist.md) | Waitlist | `WaitlistModule`, landing page email capture |
| [2b](phase-2b-calculator.md) | Calculator | `useCalculator.ts` composable, `CalculatorView` |
| [2c](phase-2c-llm.md) | LLM Integration | `LlmModule`, LiteLLM streaming client |
| [2d](phase-2d-chat.md) | Chat Advisor | `ChatModule` (SSE), `ChatView`, BYOK panel |

## Phase 2 complete when

- [x] `POST /waitlist` and `GET /waitlist/count` work
- [x] Landing page email form submits and shows success
- [x] Calculator view updates reactively with no API calls
- [x] `GET /chat/stream` streams a response from LiteLLM
- [x] Chat view renders streamed tokens progressively
- [x] BYOK key stored in localStorage, passed through to LiteLLM