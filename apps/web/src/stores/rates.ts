import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RateSnapshot, RateHistory, RateCommentary } from '../types/rates'

export const useRatesStore = defineStore('rates', () => {
  const currentRates = ref<RateSnapshot | null>(null)
  const history = ref<RateHistory[]>([])
  const commentary = ref<RateCommentary | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCurrent() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/rates/current')
      if (!res.ok) throw new Error('Failed to fetch current rates')
      currentRates.value = await res.json()
    } catch (e) {
      error.value = 'Could not load current rates'
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory(loanType = '30yr_fixed', weeks = 52) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/rates/history?loanType=${loanType}&weeks=${weeks}`)
      if (!res.ok) throw new Error('Failed to fetch rate history')
      history.value = await res.json()
    } catch (e) {
      error.value = 'Could not load rate history'
    } finally {
      loading.value = false
    }
  }

  async function fetchCommentary() {
    try {
      const res = await fetch('/api/rates/commentary')
      if (res.ok) {
        commentary.value = await res.json()
      }
    } catch {
      // Commentary is optional
    }
  }

  async function refreshAll() {
    await Promise.all([fetchCurrent(), fetchHistory(), fetchCommentary()])
  }

  return {
    currentRates,
    history,
    commentary,
    loading,
    error,
    fetchCurrent,
    fetchHistory,
    fetchCommentary,
    refreshAll,
  }
})
