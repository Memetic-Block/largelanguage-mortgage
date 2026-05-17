<script setup lang="ts">
import { onMounted } from 'vue'
import { useRatesStore } from '../stores/rates'

const ratesStore = useRatesStore()

onMounted(async () => {
  if (!ratesStore.currentRates) {
    await ratesStore.fetchCurrent()
  }
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-lg font-semibold mb-4 text-gray-700">Current Rates</h2>
    <div v-if="ratesStore.loading" class="flex justify-center py-4">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
    <div v-else-if="ratesStore.currentRates" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="(rate, type) in ratesStore.currentRates" :key="type" class="text-center">
        <div class="text-sm text-gray-600">{{ type.replace('_', '-').replace('fixed', '-fixed').replace('arm', '-ARM') }}</div>
        <div class="text-2xl font-bold text-blue-600">{{ rate.rate }}%</div>
        <div class="text-xs text-gray-500">{{ rate.date }}</div>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-4">
      Unable to load rates
    </div>
  </div>
</template>