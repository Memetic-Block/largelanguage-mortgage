<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChat } from '../composables/useChat'

const { messages, streaming, error, send } = useChat()

const input = ref('')
const selectedModel = ref('mortgage-advisor')
const byokKey = ref(localStorage.getItem('llm_api_key') ?? '')
const showByok = ref(false)

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