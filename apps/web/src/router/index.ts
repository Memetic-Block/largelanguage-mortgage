import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../views/LandingView.vue') },
  { path: '/chat', component: () => import('../views/ChatView.vue') },
  { path: '/calculator', component: () => import('../views/CalculatorView.vue') },
  { path: '/rates', component: () => import('../views/RatesView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})