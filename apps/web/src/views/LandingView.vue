<script setup lang="ts">
import LandingHero from '../components/LandingHero.vue'
import RateSnapshot from '../components/RateSnapshot.vue'
import LandingFooter from '../components/LandingFooter.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <LandingHero />
    <div class="max-w-4xl mx-auto px-4 py-8">
      <RateSnapshot />
    </div>
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-xl font-bold mb-2">Chat Advisor</h3>
          <p>Get personalized mortgage guidance with our AI assistant.</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-xl font-bold mb-2">Calculator</h3>
          <p>Model different scenarios and see how they affect your mortgage.</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-xl font-bold mb-2">Rate Tracker</h3>
          <p>Stay informed about current mortgage rates and trends.</p>
        </div>
      </div>
    </div>
    <LandingFooter />
  </div>
</template>