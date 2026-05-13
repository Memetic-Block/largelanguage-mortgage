# Phase 3b — BullMQ Jobs

Wire up BullMQ for the `fetch-rates` job: weekly cron, Redis caching of current rates, and a one-time historical seed script that backfills 3 years of data on first deploy.

Requires: Phase 3a (FRED client + entities) complete.

## Deliverables

- [ ] BullMQ `rates` queue registered in `RatesModule`
- [ ] `RatesProcessor` with `fetch-rates` job
- [ ] `RatesScheduler` — registers weekly cron on module init
- [ ] Redis caching of current rates snapshot
- [ ] `apps/api/src/scripts/seed-rates.ts` — historical backfill script
- [ ] bull-board dashboard mounted at `/admin/queues` (dev + staging)

---

## BullMQ Setup

### Install

```bash
cd apps/api
pnpm add @nestjs/bull bull
pnpm add -D @types/bull
pnpm add @bull-board/express @bull-board/api    # queue dashboard
```

### Register queue in `RatesModule`

```ts
import { BullModule } from '@nestjs/bull'

@Module({
  imports: [
    TypeOrmModule.forFeature([MortgageRate, RateCommentary]),
    BullModule.registerQueue({ name: 'rates' }),
  ],
  controllers: [RatesController],
  providers: [RatesService, RatesProcessor, RatesScheduler],
  exports: [RatesService],
})
export class RatesModule {}
```

Register `BullModule.forRootAsync(...)` in `AppModule`, reading `REDIS_URL` from `ConfigService`.

---

## RatesProcessor (`apps/api/src/rates/rates.processor.ts`)

```ts
import { Processor, Process } from '@nestjs/bull'
import { Job, Queue } from 'bull'
import { InjectQueue } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'    // or use ioredis directly
import { Redis } from 'ioredis'
import { RatesService } from './rates.service'

export const RATES_QUEUE = 'rates'
export const FETCH_RATES_JOB = 'fetch-rates'
export const GENERATE_COMMENTARY_JOB = 'generate-commentary'
export const RATES_CACHE_KEY = 'rates:current'
export const RATES_CACHE_TTL_SEC = 60 * 60 * 24 * 2    // 2 days

@Processor(RATES_QUEUE)
export class RatesProcessor {
  private readonly logger = new Logger(RatesProcessor.name)

  constructor(
    private rates: RatesService,
    @InjectQueue(RATES_QUEUE) private ratesQueue: Queue,
    @InjectRedis() private redis: Redis,
  ) {}

  @Process(FETCH_RATES_JOB)
  async fetchRates(job: Job) {
    this.logger.log('Running fetch-rates job')

    // Fetch latest rate for each series from FRED (limit=1)
    const stored = await this.rates.fetchAndStore(1)
    if (stored.length === 0) {
      this.logger.warn('fetch-rates: no data returned from FRED')
      return
    }

    // Update Redis snapshot cache
    const snapshot = await this.rates.buildCurrentSnapshot()
    await this.redis.set(RATES_CACHE_KEY, JSON.stringify(snapshot), 'EX', RATES_CACHE_TTL_SEC)
    this.logger.log('Updated rates:current cache')

    // Enqueue commentary generation for this week's date
    const latestDate = stored[0]?.date
    await this.ratesQueue.add(GENERATE_COMMENTARY_JOB, { date: latestDate })
    this.logger.log(`Enqueued generate-commentary for ${latestDate}`)
  }
}
```

### Add `buildCurrentSnapshot()` to `RatesService`

```ts
async buildCurrentSnapshot(): Promise<Record<string, { rate: number; points: number; date: string }>> {
  const loanTypes = ['30yr_fixed', '15yr_fixed', '5_1_arm']
  const snapshot: Record<string, { rate: number; points: number; date: string }> = {}

  for (const loanType of loanTypes) {
    const latest = await this.rateRepo.findOne({
      where: { loanType },
      order: { date: 'DESC' },
    })
    if (latest) {
      snapshot[loanType] = { rate: Number(latest.rate), points: Number(latest.points), date: latest.date }
    }
  }

  return snapshot
}
```

---

## RatesScheduler (`apps/api/src/rates/rates.scheduler.ts`)

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { Redis } from 'ioredis'
import { RatesService } from './rates.service'
import { RATES_QUEUE, FETCH_RATES_JOB, RATES_CACHE_KEY, RATES_CACHE_TTL_SEC } from './rates.processor'

@Injectable()
export class RatesScheduler implements OnModuleInit {
  private readonly logger = new Logger(RatesScheduler.name)

  constructor(
    @InjectQueue(RATES_QUEUE) private ratesQueue: Queue,
    @InjectRedis() private redis: Redis,
    private rates: RatesService,
  ) {}

  async onModuleInit() {
    // Warm the cache on startup if empty
    const cached = await this.redis.get(RATES_CACHE_KEY)
    if (!cached) {
      this.logger.log('Cache cold — warming rates cache on startup')
      const snapshot = await this.rates.buildCurrentSnapshot()
      if (Object.keys(snapshot).length > 0) {
        await this.redis.set(RATES_CACHE_KEY, JSON.stringify(snapshot), 'EX', RATES_CACHE_TTL_SEC)
      }
    }

    // Register weekly cron — Thursdays at 18:00 UTC
    // Freddie Mac PMMS typically publishes by 14:00 ET (19:00 UTC); 18:00 UTC is a safe margin
    await this.ratesQueue.add(
      FETCH_RATES_JOB,
      {},
      {
        repeat: { cron: '0 18 * * 4' },    // Thursday 18:00 UTC
        jobId: 'fetch-rates-weekly',        // stable ID prevents duplicate cron registrations
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    )

    this.logger.log('Registered fetch-rates weekly cron (Thu 18:00 UTC)')
  }
}
```

---

## Bull-Board Dashboard

Mount in `main.ts` for local dev and staging (not prod, or gate behind auth):

```ts
// apps/api/src/main.ts
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [new BullAdapter(app.get(getQueueToken('rates')))],
  serverAdapter,
})

app.use('/admin/queues', serverAdapter.getRouter())
```

Access at: http://localhost:3000/admin/queues

---

## Historical Seed Script (`apps/api/src/scripts/seed-rates.ts`)

Run once on first deploy to backfill 3 years of weekly history.

```ts
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { MortgageRate } from '../rates/entities/mortgage-rate.entity'
import { fetchFredSeries, FRED_SERIES } from '../rates/fred.client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../../.env.local' })

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [MortgageRate],
  synchronize: false,
})

async function seed() {
  await ds.initialize()
  const repo = ds.getRepository(MortgageRate)
  const apiKey = process.env.FRED_API_KEY!

  for (const { seriesId, loanType } of FRED_SERIES) {
    console.log(`Fetching ${seriesId} (156 weeks)...`)
    const observations = await fetchFredSeries(seriesId, apiKey, { limit: 156 })

    const values = observations.map((obs) => ({
      date: obs.date,
      loanType,
      rate: parseFloat(obs.value),
      source: 'freddie_mac_pmms',
    }))

    await repo
      .createQueryBuilder()
      .insert()
      .into(MortgageRate)
      .values(values)
      .orUpdate(['rate'], ['date', 'loanType'])
      .execute()

    console.log(`  Stored ${values.length} observations for ${loanType}`)
  }

  await ds.destroy()
  console.log('Seed complete.')
}

seed().catch(console.error)
```

Add to `package.json` scripts in `apps/api`:
```json
"seed:rates": "ts-node -r tsconfig-paths/register src/scripts/seed-rates.ts"
```

Run:
```bash
pnpm --filter api seed:rates
```

---

## Verification

```bash
# 1. Run seed script (first time only)
pnpm --filter api seed:rates
# → "Stored 156 observations for 30yr_fixed" etc.

# 2. Verify rows in Postgres
# SELECT COUNT(*), loan_type FROM mortgage_rate GROUP BY loan_type;
# → 156 rows each for 30yr_fixed, 15yr_fixed, 5_1_arm

# 3. Check Redis cache was warmed on startup
# redis-cli GET rates:current
# → JSON snapshot with all 3 loan types

# 4. Manually trigger a fetch job via bull-board
# → http://localhost:3000/admin/queues
# → rates queue → Add job → { "name": "fetch-rates" }
# → Job completes, Redis cache updated with latest Thursday rate

# 5. Verify cron is registered
# bull-board → rates queue → Repeatable jobs tab
# → "fetch-rates-weekly" listed with cron "0 18 * * 4"

# 6. Confirm upsert idempotency
# Run fetch-now twice, row count in mortgage_rate unchanged
```

---

Next: [Phase 3c — Rate Commentary](phase-3c-commentary.md)
