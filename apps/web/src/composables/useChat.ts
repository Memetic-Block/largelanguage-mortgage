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

  async function send(content: string, model: string, apiKey?: string, customModelName?: string, customApiBaseUrl?: string) {
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

    // For custom local models, we need to pass additional parameters
    if (model === 'mortgage-advisor-custom-local') {
      if (customModelName) params.append('customModelName', customModelName)
      if (customApiBaseUrl) params.append('customApiBaseUrl', customApiBaseUrl)
    }

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