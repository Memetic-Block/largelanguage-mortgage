# Phase 2d — Chat Advisor

Build the AI mortgage advisor chat. NestJS provides the SSE streaming endpoint backed by `LlmService`. Vue provides the chat UI with progressive token rendering, model selection, BYOK, and starter questions.

Requires: Phase 2c (LlmModule) complete.

## Deliverables

- [ ] `Conversation` + `Message` TypeORM entities + migration
- [ ] `ChatModule` — `POST /chat/session`, `GET /chat/stream` (SSE), `GET /chat/:id/history`
- [ ] System prompt constant (`MORTGAGE_ADVISOR_SYSTEM_PROMPT`)
- [ ] `useChat.ts` composable — `fetch` + `ReadableStream` (not `EventSource`, to support custom headers)
- [ ] `ChatView.vue` — message list, streaming, model selector, BYOK panel, starter questions

---

## Backend

### Entities

**`apps/api/src/chat/entities/conversation.entity.ts`**
```ts
@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() sessionId: string
  @OneToMany(() => Message, (m) => m.conversation, { cascade: true })
  messages: Message[]
  @CreateDateColumn() createdAt: Date
}
```

**`apps/api/src/chat/entities/message.entity.ts`**
```ts
@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string
  @ManyToOne(() => Conversation, (c) => c.messages)
  conversation: Conversation
  @Column() role: 'user' | 'assistant' | 'system'
  @Column('text') content: string
  @Column({ nullable: true }) modelUsed: string
  @CreateDateColumn() createdAt: Date
}
```

```bash
pnpm --filter api migration:generate -- src/migrations/CreateChat
pnpm --filter api migration:run
```

### System Prompt (`apps/api/src/chat/chat.constants.ts`)

```ts
export const MORTGAGE_ADVISOR_SYSTEM_PROMPT = `
You are an independent mortgage advisor. You work for the homebuyer, not any lender.
Your job is to explain mortgage concepts clearly and honestly in plain English.

Guidelines:
- Never recommend a specific lender, bank, or broker
- Model scenarios honestly — including when renting is the better financial choice
- When asked about current rates, acknowledge they change daily and direct the user to the Rates page
- Cite CFPB resources (consumerfinance.gov/owning-a-home) when relevant
- For legal, tax, or formal financial advice, always recommend consulting a licensed professional
- Be direct. Do not hedge every sentence. Give real answers.
- If you don't know something specific (e.g. local property tax rates), say so and explain how the user can find it
`.trim()
```

### DTOs

```ts
// create-session.dto.ts — no fields needed for MVP (session has no auth)

// stream-message.dto.ts
export class StreamMessageDto {
  @IsUUID() sessionId: string
  @IsString() @MaxLength(2000) message: string
  @IsOptional() @IsString() model?: string  // defaults to 'mortgage-advisor'
}
```

### ChatService (`chat.service.ts`)

```ts
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private llm: LlmService,
  ) {}

  async createSession(): Promise<string> {
    const sessionId = randomUUID()
    await this.convRepo.save({ sessionId })
    return sessionId
  }

  async getHistory(sessionId: string): Promise<Message[]> {
    const conv = await this.convRepo.findOne({
      where: { sessionId },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    })
    return conv?.messages ?? []
  }

  async *stream(
    sessionId: string,
    userMessage: string,
    model: string,
    apiKey?: string,
  ): AsyncGenerator<string> {
    const conv = await this.convRepo.findOne({
      where: { sessionId },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    })
    if (!conv) throw new NotFoundException('Session not found')

    // Persist user message
    await this.msgRepo.save({ conversation: conv, role: 'user', content: userMessage })

    // Build message array for LLM
    const messages: ChatMessage[] = [
      { role: 'system', content: MORTGAGE_ADVISOR_SYSTEM_PROMPT },
      ...conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ]

    // Stream and collect for persistence
    let fullResponse = ''
    for await (const chunk of this.llm.streamChat(messages, model, apiKey)) {
      fullResponse += chunk
      yield chunk
    }

    // Persist assistant response
    await this.msgRepo.save({
      conversation: conv,
      role: 'assistant',
      content: fullResponse,
      modelUsed: model,
    })
  }
}
```

### ChatController (`chat.controller.ts`)

```ts
@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Post('session')
  @HttpCode(201)
  async createSession(): Promise<{ sessionId: string }> {
    return { sessionId: await this.chat.createSession() }
  }

  @Sse('stream')
  @Header('Cache-Control', 'no-cache')
  stream(
    @Query() dto: StreamMessageDto,
    @Headers('x-api-key') apiKey?: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of this.chat.stream(
            dto.sessionId,
            dto.message,
            dto.model ?? 'mortgage-advisor',
            apiKey,
          )) {
            subscriber.next({ data: { chunk } } as MessageEvent)
          }
          subscriber.next({ data: { done: true } } as MessageEvent)
          subscriber.complete()
        } catch (err) {
          subscriber.next({ data: { error: (err as Error).message } } as MessageEvent)
          subscriber.complete()
        }
      })()
    })
  }

  @Get(':sessionId/history')
  history(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.chat.getHistory(sessionId)
  }
}
```

---

## Frontend

### `useChat.ts` composable

Uses `fetch` + `ReadableStream` instead of `EventSource` — required to send the `X-API-Key` header for BYOK.

```ts
import { ref } from 'vue'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export function useChat() {
  const sessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  const error = ref<string | null>(null)

  async function init() {
    const res = await fetch('/api/chat/session', { method: 'POST' })
    const data = await res.json()
    sessionId.value = data.sessionId
  }

  async function send(content: string, model: string, apiKey?: string) {
    if (!sessionId.value) await init()
    if (streaming.value) return

    messages.value.push({ id: crypto.randomUUID(), role: 'user', content })

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    messages.value.push(assistantMsg)
    streaming.value = true
    error.value = null

    const params = new URLSearchParams({
      sessionId: sessionId.value!,
      message: content,
      model,
    })

    const headers: Record<string, string> = {}
    if (apiKey) headers['X-API-Key'] = apiKey

    try {
      const res = await fetch(`/api/chat/stream?${params}`, { headers })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          try {
            const parsed = JSON.parse(raw)
            if (parsed.chunk) assistantMsg.content += parsed.chunk
            if (parsed.error) error.value = parsed.error
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      error.value = 'Connection error. Please try again.'
    } finally {
      assistantMsg.streaming = false
      streaming.value = false
    }
  }

  return { messages, streaming, error, sessionId, init, send }
}
```

### `ChatView.vue`

```vue
<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChat } from '../composables/useChat'

const { messages, streaming, error, send } = useChat()

const input = ref('')
const selectedModel = ref('mortgage-advisor')
const byokKey = ref(localStorage.getItem('llm_api_key') ?? '')
const showByok = ref(false)
const messagesEl = ref<HTMLElement>()

const MODELS = [
  { value: 'mortgage-advisor', label: 'Claude (default)' },
  { value: 'mortgage-advisor-oai', label: 'GPT-4o' },
  { value: 'mortgage-advisor-local', label: 'Local (Ollama)' },
]

const STARTERS = [
  "What's the difference between a 15 and 30-year mortgage?",
  "How much house can I afford on my income?",
  "Should I pay points to buy down my rate?",
  "When does it make sense to rent instead of buy?",
]

function saveByokKey() {
  localStorage.setItem('llm_api_key', byokKey.value)
}

async function submit() {
  const msg = input.value.trim()
  if (!msg || streaming.value) return
  input.value = ''
  await send(msg, selectedModel.value, byokKey.value || undefined)
}

// Auto-scroll to bottom on new content
watch(messages, async () => {
  await nextTick()
  messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
}, { deep: true })
</script>

<template>
  <div class="flex flex-col h-screen">

    <!-- Header -->
    <header class="flex items-center gap-4 p-4 border-b">
      <span class="font-semibold">largelanguage.mortgage</span>
      <select v-model="selectedModel">
        <option v-for="m in MODELS" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
      <button @click="showByok = !showByok" class="text-sm text-gray-500">
        {{ showByok ? 'Hide' : 'Use your own API key' }}
      </button>
    </header>

    <!-- BYOK panel -->
    <div v-if="showByok" class="p-3 bg-gray-50 border-b flex gap-2">
      <input
        v-model="byokKey"
        type="password"
        placeholder="Paste your Anthropic or OpenAI key"
        class="flex-1 text-sm border rounded px-2 py-1"
        @change="saveByokKey"
      />
      <span class="text-xs text-gray-400 self-center">Stored locally only, never sent to our servers</span>
    </div>

    <!-- Messages -->
    <main ref="messagesEl" class="flex-1 overflow-y-auto p-4 space-y-4">

      <!-- Starter questions (shown when no messages) -->
      <div v-if="messages.length === 0" class="grid grid-cols-2 gap-3 mt-8">
        <button
          v-for="q in STARTERS"
          :key="q"
          class="text-left p-3 rounded-lg border hover:bg-blue-50 text-sm"
          @click="send(q, selectedModel, byokKey || undefined)"
        >
          {{ q }}
        </button>
      </div>

      <!-- Message list -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['max-w-2xl', msg.role === 'user' ? 'ml-auto' : 'mr-auto']"
      >
        <div :class="[
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        ]">
          {{ msg.content }}
          <span v-if="msg.streaming" class="inline-block w-1 h-4 bg-current animate-pulse ml-1" />
        </div>
      </div>

      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    </main>

    <!-- Input -->
    <footer class="p-4 border-t">
      <form class="flex gap-2" @submit.prevent="submit">
        <textarea
          v-model="input"
          rows="1"
          placeholder="Ask any mortgage question..."
          class="flex-1 resize-none border rounded-lg px-3 py-2 text-sm"
          :disabled="streaming"
          @keydown.enter.exact.prevent="submit"
        />
        <button
          type="submit"
          :disabled="streaming || !input.trim()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
        >
          {{ streaming ? '...' : 'Send' }}
        </button>
      </form>
      <p class="text-xs text-gray-400 mt-1">
        Not financial advice. <a href="https://www.consumerfinance.gov/owning-a-home/" class="underline">CFPB Resources</a>
      </p>
    </footer>

  </div>
</template>
```

---

## Verification

```bash
# Create session
curl -X POST http://localhost:3000/chat/session
# → { "sessionId": "uuid-here" }

# Stream a message
curl "http://localhost:3000/chat/stream?sessionId=<uuid>&message=What+is+PMI%3F" \
  -H 'Accept: text/event-stream'
# → data: {"chunk":"PMI"} ... data: {"chunk":" stands"} ... data: {"done":true}

# History persisted
curl http://localhost:3000/chat/<uuid>/history
# → array with user + assistant messages

# BYOK (pass a real key)
curl "http://localhost:3000/chat/stream?sessionId=<uuid>&message=ping" \
  -H "X-API-Key: $ANTHROPIC_KEY"
# → streams using provided key

# Browser: http://localhost:5173/chat
# - Starter questions visible on empty state
# - Click a starter → submits and streams
# - Cursor blinks while streaming
# - Enter key submits (Shift+Enter for newline)
# - Model selector switches model mid-conversation
# - BYOK key persists across page refresh (localStorage)
```

---

Next: [Phase 3a — FRED Client](phase-3a-fred-client.md)
