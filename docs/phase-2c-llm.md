# Phase 2c — LLM Integration

Wire up the LiteLLM proxy as a NestJS module. This is the foundation Chat (2d) and Rate Commentary (3c) both depend on. Goal: a single `LlmService.streamChat()` method that yields text chunks from any configured model.

## Deliverables

- [x] `services/litellm/config.yaml` — complete, with all three model aliases
- [x] `LlmModule` + `LlmService` in `apps/api`
- [x] SSE stream parser utility (`parseSSEStream`)
- [x] Dev smoke test: `GET /llm/test` streams a one-shot response

---