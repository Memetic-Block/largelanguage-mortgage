import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const seedMessage = ref<string | null>(null)

  return { seedMessage }
})
