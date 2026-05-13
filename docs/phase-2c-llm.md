# Phase 2c — LLM Integration

Wire up the LiteLLM proxy as a NestJS module. This is the foundation Chat (2d) and Rate Commentary (3c) both depend on. Goal: a single `LlmService.streamChat()` method that yields text chunks from any configured model.

## Deliverables

- [ ] `services/litellm/config.yaml` — complete, with all three model aliases
- [ ] `LlmModule` + `LlmService` in `apps/api`
- [ ] SSE stream parser utility (`parseSSEStream`)
- [ ] Dev smoke test: `GET /llm/test` streams a one-shot response

---

## LiteLLM Config (`services/litellm/config.yaml`)

```yaml
model_list:
  - model_name: mortgage-advisor
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_KEY

  - model_name: mortgage-advisor-oai
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_KEY

  - model_name: mortgage-advisor-local
    litellm_params:
      model: ollama/llama3
      api_base: http://host.docker.internal:11434

general_settings:
  allow_user_auth: true      # enables BYOK via Authorization header

litellm_settings:
  drop_params: true          # silently ignore unsupported params per model
  request_timeout: 120
```

**Adding a new model:** add an entry to `model_list`, restart the LiteLLM container (`docker-compose restart litellm`). No API code changes needed.

---

## SSE Stream Parser (`apps/api/src/llm/sse-stream.util.ts`)

LiteLLM streams OpenAI-compatible SSE. Each line is `data: {...}` or `data: [DONE]`.

```ts
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): AsyncGenerator<{ choices: { delta: { content?: string } }[] }> {
  const decoder = new TextDecoder()
  let buffer = ''

  // Handle both browser ReadableStream and Node stream
  const stream = body instanceof ReadableStream
    ? body
    : readableStreamFromNode(body)

  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data)
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function readableStreamFromNode(
  stream: NodeJS.ReadableStream,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(
        typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk,
      ))
      stream.on('end', () => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
  })
}
```

---

## LlmService (`apps/api/src/llm/llm.service.ts`)

```ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

@Injectable()
export class LlmService {
  private readonly litellmUrl: string
  private readonly logger = new Logger(LlmService.name)

  constructor(private config: ConfigService) {
    this.litellmUrl = config.getOrThrow('LITELLM_URL')
  }

  async *streamChat(
    messages: ChatMessage[],
    model = 'mortgage-advisor',
    apiKey?: string,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${this.litellmUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    })

    if (!response.ok) {
      const body = await response.text()
      this.logger.error(`LiteLLM error ${response.status}: ${body}`)
      throw new Error(`LLM request failed: ${response.status}`)
    }

    if (!response.body) throw new Error('No response body from LiteLLM')

    for await (const chunk of parseSSEStream(response.body)) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) yield delta
    }
  }

  // Non-streaming: collect full response (for jobs like commentary generation)
  async complete(
    messages: ChatMessage[],
    model = 'mortgage-advisor',
  ): Promise<string> {
    let result = ''
    for await (const chunk of this.streamChat(messages, model)) {
      result += chunk
    }
    return result
  }
}
```

### LlmModule (`llm.module.ts`)

```ts
@Module({
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
```

Export `LlmService` so `ChatModule` and `RatesModule` can import it.

---

## Dev Smoke Test Endpoint

Add a dev-only controller for quick verification. Guard it with `NODE_ENV !== 'production'`:

```ts
// apps/api/src/llm/llm.controller.ts
@Controller('llm')
export class LlmController {
  constructor(private llm: LlmService) {}

  @Get('test')
  @Sse()
  @Header('Cache-Control', 'no-cache')
  test(): Observable<MessageEvent> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException()
    }

    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of this.llm.streamChat([
            { role: 'user', content: 'Say "LLM connection successful" and nothing else.' },
          ])) {
            subscriber.next({ data: { chunk } } as MessageEvent)
          }
          subscriber.complete()
        } catch (err) {
          subscriber.error(err)
        }
      })()
    })
  }
}
```

---

## Verification

```bash
# 1. LiteLLM container is up
docker-compose up -d litellm
curl http://localhost:4000/health
# → { "status": "healthy" }

# 2. Direct LiteLLM call (bypassing NestJS)
curl http://localhost:4000/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ANTHROPIC_KEY" \
  -d '{"model":"mortgage-advisor","messages":[{"role":"user","content":"ping"}],"stream":true}'
# → SSE stream of chunks ending in data: [DONE]

# 3. Via NestJS dev endpoint
curl http://localhost:3000/llm/test \
  -H 'Accept: text/event-stream'
# → streams "LLM connection successful" in SSE chunks

# 4. BYOK test
curl http://localhost:3000/llm/test \
  -H 'Accept: text/event-stream' \
  -H "X-API-Key: $ANTHROPIC_KEY"
# → same result, using the provided key
```

---

Next: [Phase 2d — Chat Advisor](phase-2d-chat.md)
