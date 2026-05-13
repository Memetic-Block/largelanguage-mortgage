# Phase 3d — Rates View

Wire up the `GET /rates/*` endpoints and build the Rates view: current rate cards, a 12-month line chart, AI commentary, and a CTA that opens Chat with a pre-seeded message. Also wire the landing page rate snapshot.

Requires: Phases 3a, 3b, 3c complete.

## Deliverables

- [ ] `GET /rates/current` — Redis cache → FRED fallback
- [ ] `GET /rates/history?weeks=N` — historical weekly rates from Postgres
- [ ] `useRates.ts` composable
- [ ] `useRatesStore` (Pinia) — shared across Landing + Rates view
- [ ] `RatesView.vue` — rate cards, chart (Chart.js), commentary, CTA
- [ ] `RateSnapshot.vue` on landing page wired to live data

---

## Backend — RatesService final endpoints

Add to `RatesService`:

```ts
async getCurrentRates(): Promise<Record<string, { rate: number; points: number; date: string }>> {
  // Redis first
  const cached = await this.redis.get(RATES_CACHE_KEY)
  if (cached) return JSON.parse(cached)

  // Cache miss: build from DB (seed must have run)
  const snapshot = await this.buildCurrentSnapshot()
  if (Object.keys(snapshot).length > 0) {
    await this.redis.set(RATES_CACHE_KEY, JSON.stringify(snapshot), 'EX', RATES_CACHE_TTL_SEC)
  }
  return snapshot
}

async getHistory(loanType: string, weeks: number): Promise<MortgageRate[]> {
  return this.rateRepo.find({
    where: { loanType },
    order: { date: 'ASC' },             // ASC for charting (chronological)
    take: Math.min(weeks, 156),         // cap at 3 years
  })
}
```

## Backend — RatesController final

```ts
@Controller('rates')
export class RatesController {
  constructor(
    private rates: RatesService,
    @InjectQueue(RATES_QUEUE) private ratesQueue: Queue,
  ) {}

  @Get('current')
  getCurrentRates() {
    return this.rates.getCurrentRates()
  }

  @Get('history')
  getHistory(
    @Query('weeks', new DefaultValuePipe(52), ParseIntPipe) weeks: number,
    @Query('loanType', new DefaultValuePipe('30yr_fixed')) loanType: string,
  ) {
    return this.rates.getHistory(loanType, weeks)
  }

  @Get('commentary')
  getCommentary() {
    return this.rates.getLatestCommentary()
  }

  // Dev-only endpoints (from 3a, 3c) remain here, guarded by NODE_ENV check
}
```

---

## Frontend

### Types (`apps/web/src/types/rates.ts`)

```ts
export interface RateSnapshot {
  '30yr_fixed': { rate: number; points: number; date: string }
  '15yr_fixed': { rate: number; points: number; date: string }
  '5_1_arm':    { rate: number; points: number; date: string }
}

export interface RateHistory {
  date: string
  rate: number
}

export interface RateCommentary {
  rateDate: string
  commentary: string
  generatedAt: string
}
```

### Pinia store (`apps/web/src/stores/rates.ts`)

```ts
import { defineStore } from 'pinia'
import type { RateSnapshot, RateCommentary } from '../types/rates'

export const useRatesStore = defineStore('rates', {
  state: () => ({
    current: null as RateSnapshot | null,
    commentary: null as RateCommentary | null,
    loading: false,
  }),
  actions: {
    async fetchCurrent() {
      if (this.current) return         // already loaded — don't re-fetch
      this.loading = true
      try {
        this.current = await fetch('/api/rates/current').then((r) => r.json())
      } finally {
        this.loading = false
      }
    },
    async fetchCommentary() {
      if (this.commentary) return
      this.commentary = await fetch('/api/rates/commentary').then((r) => r.json())
    },
  },
})
```

### `useRates.ts` composable

```ts
import { ref, onMounted } from 'vue'
import { useRatesStore } from '../stores/rates'
import type { RateHistory } from '../types/rates'

export function useRates() {
  const store = useRatesStore()
  const history = ref<RateHistory[]>([])
  const historyLoading = ref(false)

  async function loadHistory(weeks = 52, loanType = '30yr_fixed') {
    historyLoading.value = true
    const data = await fetch(`/api/rates/history?weeks=${weeks}&loanType=${loanType}`)
      .then((r) => r.json())
    history.value = data.map((r: { date: string; rate: string }) => ({
      date: r.date,
      rate: parseFloat(r.rate),
    }))
    historyLoading.value = false
  }

  onMounted(async () => {
    await Promise.all([
      store.fetchCurrent(),
      store.fetchCommentary(),
      loadHistory(),
    ])
  })

  return {
    current: store.current,        // from Pinia (shared with landing)
    commentary: store.commentary,
    loading: store.loading,
    history,
    historyLoading,
  }
}
```

---

### `RatesView.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { useRates } from '../composables/useRates'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const { current, commentary, loading, history, historyLoading } = useRates()
const router = useRouter()
const chatStore = useChatStore()

const LOAN_TYPE_LABELS: Record<string, string> = {
  '30yr_fixed': '30-Year Fixed',
  '15yr_fixed': '15-Year Fixed',
  '5_1_arm':    '5/1 ARM',
}

const chartData = computed(() => ({
  labels: history.value.map((r) => r.date),
  datasets: [{
    label: '30-yr Fixed Rate (%)',
    data: history.value.map((r) => r.rate),
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.08)',
    fill: true,
    tension: 0.3,
    pointRadius: 0,
  }],
}))

const chartOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: { title: { display: true, text: 'Rate (%)' } },
    x: { ticks: { maxTicksLimit: 12 } },
  },
}

function askAboutRates() {
  const rate = current?.['30yr_fixed']?.rate
  const seed = rate
    ? `Current 30-year fixed rates are around ${rate}%. What does this mean for someone shopping for a home right now?`
    : 'Can you explain what current mortgage rates mean for home buyers?'
  chatStore.seedMessage = seed
  router.push('/chat')
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <h1 class="text-2xl font-bold">Current Mortgage Rates</h1>

    <!-- Rate cards -->
    <div v-if="loading" class="grid grid-cols-3 gap-4 animate-pulse">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-100 rounded-xl" />
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        v-for="(key, i) in ['30yr_fixed', '15yr_fixed', '5_1_arm']"
        :key="key"
        class="bg-white border rounded-xl p-5"
        :class="{ 'border-blue-500': i === 0 }"
      >
        <p class="text-sm text-gray-500">{{ LOAN_TYPE_LABELS[key] }}</p>
        <p class="text-3xl font-bold mt-1">
          {{ current?.[key as keyof typeof current]?.rate?.toFixed(3) ?? '--' }}%
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ current?.[key as keyof typeof current]?.points ?? '--' }} avg. points ·
          {{ current?.[key as keyof typeof current]?.date ?? '' }}
        </p>
      </div>
    </div>

    <!-- AI Commentary -->
    <div v-if="commentary" class="bg-blue-50 border border-blue-100 rounded-xl p-5">
      <p class="text-xs font-medium text-blue-600 mb-2">AI Rate Commentary</p>
      <p class="text-gray-800 leading-relaxed">{{ commentary.commentary }}</p>
      <p class="text-xs text-gray-400 mt-3">Generated {{ new Date(commentary.generatedAt).toLocaleDateString() }}</p>
    </div>

    <!-- Chart -->
    <div>
      <h2 class="text-lg font-semibold mb-3">12-Month Rate History (30-yr Fixed)</h2>
      <div v-if="historyLoading" class="h-48 bg-gray-100 rounded-xl animate-pulse" />
      <Line v-else :data="chartData" :options="chartOptions" class="max-h-64" />
    </div>

    <!-- CTA -->
    <div class="text-center">
      <button
        @click="askAboutRates"
        class="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
      >
        What do these rates mean for me?
      </button>
      <p class="text-xs text-gray-400 mt-2">Opens the AI mortgage advisor with context pre-filled</p>
    </div>

    <!-- Attribution -->
    <p class="text-xs text-gray-400 text-center">
      Source: Freddie Mac Primary Mortgage Market Survey via
      <a href="https://fred.stlouisfed.org" class="underline">FRED</a>.
      Updated weekly on Thursdays.
    </p>
  </div>
</template>
```

**Install chart.js packages:**
```bash
pnpm --filter web add chart.js vue-chartjs
```

### Chat store seed message (`apps/web/src/stores/chat.ts`)

Add a `seedMessage` field to the chat Pinia store. In `ChatView.vue`, on mount, check `chatStore.seedMessage`, pre-fill it, auto-submit if set, then clear it:

```ts
onMounted(async () => {
  await chatStore.init()
  if (chatStore.seedMessage) {
    const msg = chatStore.seedMessage
    chatStore.seedMessage = null
    send(msg, selectedModel.value)
  }
})
```

### Landing page `RateSnapshot.vue` — now wired

The landing page calls `useRatesStore().fetchCurrent()` on mount. `RateSnapshot.vue` reads from the store — no duplicate fetch since Pinia guards with `if (this.current) return`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRatesStore } from '../stores/rates'

const store = useRatesStore()
onMounted(() => store.fetchCurrent())
</script>

<template>
  <div class="inline-flex items-baseline gap-2 bg-white border rounded-xl px-5 py-3 shadow-sm">
    <span class="text-sm text-gray-500">30-yr fixed</span>
    <span class="text-2xl font-bold text-blue-700">
      {{ store.current?.['30yr_fixed']?.rate?.toFixed(3) ?? '--' }}%
    </span>
    <span class="text-xs text-gray-400">Freddie Mac / FRED</span>
  </div>
</template>
```

---

## Verification

```bash
# API endpoints
curl http://localhost:3000/rates/current
# → { "30yr_fixed": { "rate": 6.875, "points": 0.8, "date": "2026-05-08" }, ... }

curl "http://localhost:3000/rates/history?weeks=4&loanType=30yr_fixed"
# → array of 4 objects in chronological order

curl http://localhost:3000/rates/commentary
# → { "rateDate": "2026-05-08", "commentary": "...", "generatedAt": "..." }

# Browser
# / (landing) — rate snapshot shows live rate, not "--"
# /rates — all 3 rate cards populated, chart renders 52 data points,
#           commentary box shows AI text, "What does this mean for me?" button present
# Click the CTA → navigates to /chat, message pre-filled and submitted automatically
# Rates page: zero duplicate API calls (Pinia cache works)
```

Phase 3 complete. See [Phase 4 — Deploy](phase-4-deploy.md) and [Phase 4 — DevOps Agent](phase-4-devops-agent.md).
