<script setup lang="ts">
import { ref } from 'vue'
import { useWaitlist } from '../composables/useWaitlist'

const email = ref('')
const { state, errorMessage, subscribe } = useWaitlist()

function submit() {
  if (email.value) subscribe(email.value)
}
</script>

<template>
  <section class="max-w-4xl mx-auto px-4 py-12">
    <h1 class="text-4xl font-bold text-center mb-4">The mortgage AI that works for you, not the bank.</h1>
    <p class="text-xl text-center mb-8">Ask any mortgage question. Model any scenario. No lender affiliation. No conflict of interest.</p>

    <form v-if="state !== 'success'" @submit.prevent="submit" class="max-w-md mx-auto">
      <input
        v-model="email"
        type="email"
        placeholder="your@email.com"
        required
        :disabled="state === 'loading'"
        class="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button 
        type="submit" 
        :disabled="state === 'loading'"
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ state === 'loading' ? 'Joining...' : 'Get early access' }}
      </button>
      <p v-if="state === 'error'" class="text-red-500 mt-2">{{ errorMessage }}</p>
    </form>

    <p v-else class="text-green-600 text-center mt-4">You're on the list.</p>
  </section>
</template>