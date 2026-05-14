# Phase 2d — Chat Advisor

Build the AI mortgage advisor chat. NestJS provides the SSE streaming endpoint backed by `LlmService`. Vue provides the chat UI with progressive token rendering, model selection, BYOK, and starter questions.

Requires: Phase 2c (LlmModule) complete.

## Deliverables

- [x] `Conversation` + `Message` TypeORM entities + migration
- [x] `ChatModule` — `POST /chat/session`, `GET /chat/stream` (SSE), `GET /chat/:id/history`
- [x] System prompt constant (`MORTGAGE_ADVISOR_SYSTEM_PROMPT`)
- [x] `useChat.ts` composable — `fetch` + `ReadableStream` (not `EventSource`, to support custom headers)
- [x] `ChatView.vue` — message list, streaming, model selector, BYOK panel, starter questions

---