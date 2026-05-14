<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <div class="text-xl font-bold">Mortgage AI</div>
          <div class="space-x-4">
            <router-link to="/" class="text-blue-600 hover:underline">Home</router-link>
            <router-link to="/chat" class="text-blue-600 hover:underline">Chat</router-link>
            <router-link to="/calculator" class="text-blue-600 hover:underline">Calculator</router-link>
            <router-link to="/rates" class="text-blue-600 hover:underline">Rates</router-link>
          </div>
        </div>
      </div>
    </nav>
    <RouterView />
  </div>
</template>