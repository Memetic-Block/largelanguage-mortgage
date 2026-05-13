# Phase 3a — FRED Client

Create the rate entities, run migrations, and build the FRED API client utility. At the end of this sub-phase, you can fetch live rates from the Federal Reserve and store them — no BullMQ yet, just the plumbing.

## Deliverables

- [ ] `MortgageRate` TypeORM entity + migration
- [ ] `RateCommentary` TypeORM entity (empty for now, used in 3c)
- [ ] `fred.client.ts` — typed FRED API fetch utility
- [ ] `RatesModule` bootstrap (service stub, module registered)
- [ ] Dev endpoint `GET /rates/fetch-now` to trigger a live FRED fetch manually

---

## Entities

### `apps/api/src/rates/entities/mortgage-rate.entity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm'

@Entity()
@Unique(['date', 'loanType'])          // upsert key — one row per loan type per week
export class MortgageRate {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ type: 'date' })
  date: string                          // YYYY-MM-DD (the Thursday of that week)

  @Column()
  loanType: string                      // '30yr_fixed' | '15yr_fixed' | '5_1_arm'

  @Column({ type: 'numeric', precision: 5, scale: 3 })
  rate: number                          // e.g. 6.875

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  points: number                        // Freddie Mac PMMS includes avg points

  @Column()
  source: string                        // 'freddie_mac_pmms'

  @CreateDateColumn() createdAt: Date
}
```

### `apps/api/src/rates/entities/rate-commentary.entity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm'

@Entity()
@Unique(['rateDate'])
export class RateCommentary {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ type: 'date' })
  rateDate: string                      // matches MortgageRate.date

  @Column('text')
  commentary: string

  @CreateDateColumn() generatedAt: Date
}
```

```bash
pnpm --filter api migration:generate -- src/migrations/CreateRates
pnpm --filter api migration:run
```

---

## FRED API Client (`apps/api/src/rates/fred.client.ts`)

FRED series IDs used:
| Series ID | Description |
|---|---|
| `MORTGAGE30US` | 30-yr fixed, Freddie Mac PMMS |
| `MORTGAGE15US` | 15-yr fixed, Freddie Mac PMMS |
| `MORTGAGE5US` | 5/1 ARM, Freddie Mac PMMS |

Get a free API key at https://fred.stlouisfed.org/docs/api/api_key.html

```ts
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

export interface FredObservation {
  date: string      // YYYY-MM-DD
  value: string     // numeric string, or '.' when data unavailable
}

export interface FredFetchOptions {
  limit?: number            // number of most-recent observations to return
  observationStart?: string // YYYY-MM-DD — fetch from this date onward
}

export async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  options: FredFetchOptions = {},
): Promise<FredObservation[]> {
  const url = new URL(FRED_BASE)
  url.searchParams.set('series_id', seriesId)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('sort_order', 'desc')

  if (options.limit) url.searchParams.set('limit', String(options.limit))
  if (options.observationStart) url.searchParams.set('observation_start', options.observationStart)

  const res = await fetch(url.toString())

  if (res.status === 429) throw new Error('FRED API rate limit exceeded')
  if (!res.ok) throw new Error(`FRED API error: ${res.status} ${await res.text()}`)

  const json = await res.json()

  // Filter out missing observations ('.')
  return (json.observations as FredObservation[]).filter((o) => o.value !== '.')
}

// Map FRED series ID → our loanType label
export const FRED_SERIES: Array<{ seriesId: string; loanType: string }> = [
  { seriesId: 'MORTGAGE30US', loanType: '30yr_fixed' },
  { seriesId: 'MORTGAGE15US', loanType: '15yr_fixed' },
  { seriesId: 'MORTGAGE5US',  loanType: '5_1_arm' },
]
```

---

## RatesModule Bootstrap

### `rates.service.ts` (stub — expanded in 3b and 3d)

```ts
@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name)

  constructor(
    @InjectRepository(MortgageRate) private rateRepo: Repository<MortgageRate>,
    @InjectRepository(RateCommentary) private commentaryRepo: Repository<RateCommentary>,
    private config: ConfigService,
  ) {}

  async fetchAndStore(limit = 1): Promise<MortgageRate[]> {
    const apiKey = this.config.getOrThrow('FRED_API_KEY')
    const stored: MortgageRate[] = []

    for (const { seriesId, loanType } of FRED_SERIES) {
      const observations = await fetchFredSeries(seriesId, apiKey, { limit })

      for (const obs of observations) {
        const [saved] = await this.rateRepo
          .createQueryBuilder()
          .insert()
          .into(MortgageRate)
          .values({
            date: obs.date,
            loanType,
            rate: parseFloat(obs.value),
            source: 'freddie_mac_pmms',
          })
          .orUpdate(['rate'], ['date', 'loanType'])
          .returning('*')
          .execute()
          .then((r) => r.generatedMaps)

        stored.push(saved as MortgageRate)
        this.logger.log(`Stored ${loanType} rate for ${obs.date}: ${obs.value}%`)
      }
    }

    return stored
  }
}
```

### `rates.module.ts`

```ts
@Module({
  imports: [TypeOrmModule.forFeature([MortgageRate, RateCommentary])],
  controllers: [RatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
```

### `rates.controller.ts` (stub — expanded in 3d, dev endpoint only for now)

```ts
@Controller('rates')
export class RatesController {
  constructor(private rates: RatesService) {}

  // Dev-only: trigger a live FRED fetch
  @Post('fetch-now')
  async fetchNow() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException()
    return this.rates.fetchAndStore(1)
  }
}
```

---

## Verification

```bash
# 1. Confirm FRED API key works
curl "https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=$FRED_API_KEY&file_type=json&limit=1&sort_order=desc"
# → JSON with observations array, latest rate

# 2. Trigger fetch via dev endpoint
curl -X POST http://localhost:3000/rates/fetch-now
# → array of MortgageRate objects stored in DB

# 3. Verify in Postgres
# psql $DATABASE_URL -c "SELECT date, loan_type, rate FROM mortgage_rate ORDER BY date DESC LIMIT 6;"
# → 3 rows (one per loan type) with the latest Thursday's date

# 4. Upsert is idempotent — run fetch-now twice, no duplicate rows
curl -X POST http://localhost:3000/rates/fetch-now
curl -X POST http://localhost:3000/rates/fetch-now
# psql → still 3 rows, rates may be updated but no duplicates
```

---

Next: [Phase 3b — BullMQ Jobs](phase-3b-bullmq-jobs.md)
