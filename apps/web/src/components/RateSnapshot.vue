<script setup lang="ts">
import { useRatesStore } from '../stores/rates'
const ratesStore = useRatesStore()
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <span class="label text-sm text-gray-600">30-yr fixed</span>
    <span class="rate text-2xl font-bold">{{ ratesStore.current?.['30yr_fixed']?.rate ?? '--' }}%</span>
    <span class="source text-sm text-gray-500">Freddie Mac / FRED</span>
  </div>
</template>