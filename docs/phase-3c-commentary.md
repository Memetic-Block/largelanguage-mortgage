# Phase 3c — Rate Commentary

Generate the weekly AI commentary on mortgage rate moves. Plugs into the `generate-commentary` BullMQ job queued by `fetch-rates`, writes to the `RateCommentary` entity, and exposes it via `GET /rates/commentary`.

Requires: Phase 3b (BullMQ fetch-rates job) and Phase 2c (LlmModule) complete.

## Deliverables

- [ ] `buildCommentaryPrompt()` — prompt builder using recent rate history
- [ ] `generate-commentary` processor added to `RatesProcessor`
- [ ] `GET /rates/commentary` endpoint returning latest `RateCommentary`
- [ ] Commentary stored idempotently (upsert on `rateDate`)

---

## Prompt Builder (`apps/api/src/rates/commentary.prompts.ts`)

```ts
import { MortgageRate } from './entities/mortgage-rate.entity'

export function buildCommentaryPrompt(recentRates: MortgageRate[]): string {
  // recentRates: last 4 weeks of 30yr_fixed, ordered DESC (most recent first)
  const [latest, ...prior] = recentRates

  if (!latest) return ''

  const currentRate = Number(latest.rate)
  const previousRate = prior[0] ? Number(prior[0].rate) : null

  const direction = previousRate === null
    ? 'unchanged'
    : currentRate > previousRate
      ? `up ${(currentRate - previousRate).toFixed(3)} percentage points`
      : currentRate < previousRate
        ? `down ${(previousRate - currentRate).toFixed(3)} percentage points`
        : 'unchanged'

  const historyTable = [latest, ...prior]
    .map((r) => `  ${r.date}: ${Number(r.rate).toFixed(3)}%`)
    .join('\n')

  return `
You are a neutral mortgage market analyst. Write commentary for homebuyers — people actively shopping for a home or mortgage, not investors or industry professionals.

Recent 30-year fixed mortgage rates (Freddie Mac PMMS):
${historyTable}

This week's rate is ${currentRate.toFixed(3)}% — ${direction} from last week.

Write exactly 3 sentences:
1. What happened to rates this week (the movement, the magnitude)
2. The likely driver in plain terms (Fed policy, bond markets, inflation, economic data — pick the most relevant, don't speculate if uncertain)
3. What this means practically for someone shopping for a $400,000 home right now (dollar impact on monthly payment compared to last week, if meaningful)

Rules:
- Plain English. No jargon without a brief explanation.
- Do not recommend buying, waiting, or any specific action.
- Do not mention specific lenders.
- Do not use the phrase "it's important to note" or similar filler.
- Be direct. Three sentences, no more.
`.trim()
}
```

---

## Commentary Processor (add to `RatesProcessor`)

```ts
@Process(GENERATE_COMMENTARY_JOB)
async generateCommentary(job: Job<{ date: string }>) {
  const { date } = job.data
  this.logger.log(`Generating commentary for ${date}`)

  // Fetch last 4 weeks of 30yr fixed for context
  const recentRates = await this.rates.getRecentRates('30yr_fixed', 4)

  if (recentRates.length === 0) {
    this.logger.warn('generate-commentary: no rate data found, skipping')
    return
  }

  const prompt = buildCommentaryPrompt(recentRates)
  const commentary = await this.llm.complete(
    [{ role: 'user', content: prompt }],
    'mortgage-advisor',
  )

  await this.rates.saveCommentary(date, commentary)
  this.logger.log(`Commentary saved for ${date}`)
}
```

`LlmService` must be injected into `RatesProcessor`. Add `LlmModule` to `RatesModule` imports.

---

## RatesService additions

```ts
async getRecentRates(loanType: string, weeks: number): Promise<MortgageRate[]> {
  return this.rateRepo.find({
    where: { loanType },
    order: { date: 'DESC' },
    take: weeks,
  })
}

async saveCommentary(rateDate: string, commentary: string): Promise<void> {
  await this.commentaryRepo
    .createQueryBuilder()
    .insert()
    .into(RateCommentary)
    .values({ rateDate, commentary })
    .orUpdate(['commentary', 'generatedAt'], ['rateDate'])
    .execute()
}

async getLatestCommentary(): Promise<RateCommentary | null> {
  return this.commentaryRepo.findOne({ order: { rateDate: 'DESC' } })
}
```

---

## Controller endpoint (add to `RatesController`)

```ts
@Get('commentary')
async getCommentary(): Promise<RateCommentary | null> {
  return this.rates.getLatestCommentary()
}
```

---

## Manual Trigger for Dev

Add a dev-only endpoint to generate commentary on demand without waiting for the weekly cron:

```ts
@Post('generate-commentary')
async generateCommentary() {
  if (process.env.NODE_ENV === 'production') throw new ForbiddenException()
  const latest = await this.rates.getRecentRates('30yr_fixed', 1)
  if (!latest[0]) throw new NotFoundException('No rate data found')
  await this.ratesQueue.add(GENERATE_COMMENTARY_JOB, { date: latest[0].date })
  return { queued: true, date: latest[0].date }
}
```

---

## Prompt Quality Guidelines

If the generated commentary is poor, tune the prompt — not the architecture. Common issues:

| Problem | Fix |
|---|---|
| Too hedged / full of disclaimers | Add "Be direct" rule, reduce temperature in LiteLLM config |
| Mentions specific lenders | Add explicit prohibition to prompt |
| More than 3 sentences | Add "exactly 3 sentences" enforcement |
| Uses jargon without explanation | Add jargon rule |
| Wrong dollar impact calculation | Provide the formula: `rate_change_bps * loan_amount / 10000 / 12` in the prompt |

To test prompt changes without waiting for a rate update, use the dev endpoint with existing data.

---

## Verification

```bash
# Seed rates first if not already done (Phase 3b)

# 1. Trigger commentary generation
curl -X POST http://localhost:3000/rates/generate-commentary
# → { "queued": true, "date": "2026-05-08" }

# 2. Check bull-board — job should complete within ~10 seconds
# http://localhost:3000/admin/queues → rates → Completed

# 3. Fetch the commentary
curl http://localhost:3000/rates/commentary
# → {
#     "id": "uuid",
#     "rateDate": "2026-05-08",
#     "commentary": "30-year fixed rates rose 0.125 percentage points this week...",
#     "generatedAt": "2026-05-13T..."
#   }

# 4. Upsert idempotency
# Trigger generate-commentary for same date again → same row updated, not duplicated
# SELECT COUNT(*) FROM rate_commentary WHERE rate_date = '2026-05-08';
# → 1

# 5. Quality check
# Read the commentary — it should be 3 plain sentences, no lender names,
# no excessive hedging, with a concrete dollar-impact statement.
# If not, tune commentary.prompts.ts.
```

---

Next: [Phase 3d — Rates View](phase-3d-rates-view.md)
