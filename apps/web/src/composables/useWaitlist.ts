import { ref } from 'vue'

type State = 'idle' | 'loading' | 'success' | 'error'

export function useWaitlist() {
  const state = ref<State>('idle')
  const errorMessage = ref('')

  async function subscribe(email: string, source = 'landing') {
    state.value = 'loading'
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      if (!res.ok) throw new Error('Request failed')
      state.value = 'success'
    } catch {
      state.value = 'error'
      errorMessage.value = 'Something went wrong. Please try again.'
    }
  }

  return { state, errorMessage, subscribe }
}