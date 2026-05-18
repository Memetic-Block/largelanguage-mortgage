<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRatesStore } from '../stores/rates'
import { useChatStore } from '../stores/chat'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const ratesStore = useRatesStore()
const chatStore = useChatStore()
const router = useRouter()

const chartData = computed(() => ({
  labels: ratesStore.history.map((h) => h.date),
  datasets: [
    {
      label: '30-yr fixed',
      data: ratesStore.history.map((h) => h.rate),
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      tension: 0.3,
      fill: true,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
  scales: {
    y: {
      ticks: { callback: (_v: number | string) => String(_v) + '%' },
    },
  },
} as const

function askAboutRates() {
  const rate = ratesStore.currentRates?.['30yr_fixed']?.rate
  chatStore.seedMessage = rate
    ? `Current 30-year fixed rates are around ${rate}%. What does this mean for someone shopping for a home right now?`
    : 'Can you explain what current mortgage rates mean for home buyers?'
  router.push('/chat')
}

onMounted(async () => {
  await ratesStore.refreshAll()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Current Mortgage Rates</h1>

    <!-- Loading state -->
    <div v-if="ratesStore.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="ratesStore.error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
      {{ ratesStore.error }}
    </div>

    <!-- Rate cards -->
    <div v-else-if="ratesStore.currentRates" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div v-for="(rate, type) in ratesStore.currentRates" :key="type" class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-600 mb-1">{{ type.replace('_', '-').replace('fixed', '-fixed').replace('arm', '-ARM') }}</div>
        <div class="text-3xl font-bold text-blue-600">{{ rate.rate }}%</div>
        <div class="text-sm text-gray-500 mt-2">{{ rate.date }}</div>
        <div v-if="rate.points" class="text-xs text-gray-400 mt-1">Avg points: {{ rate.points }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div v-if="ratesStore.history.length > 0" class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">30-Year Fixed Rate Trend</h2>
      <div class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <!-- Commentary -->
    <div v-if="ratesStore.commentary" class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-2 text-blue-900">Market Commentary</h2>
      <p class="text-sm text-blue-700 mb-2">As of {{ ratesStore.commentary.rateDate }}</p>
      <p class="text-gray-700">{{ ratesStore.commentary.commentary }}</p>
    </div>

    <!-- CTA -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-center text-white">
      <h2 class="text-2xl font-bold mb-2">Ready to explore your options?</h2>
      <p class="mb-4">Chat with our AI mortgage advisor for personalized guidance.</p>
      <button @click="askAboutRates" class="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
        What do these rates mean for me?
      </button>
    </div>
  </div>
</template>
