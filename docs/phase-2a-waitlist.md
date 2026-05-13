# Phase 2a — Waitlist

Build the `WaitlistModule` (API) and the landing page with working email capture (frontend). The landing page is a placeholder for the full hero — it just needs to be presentable and capture emails.

## Deliverables

- [ ] `Waitlist` TypeORM entity + migration
- [ ] `CreateWaitlistDto` with email validation
- [ ] `WaitlistService` — insert (idempotent on duplicate) + count
- [ ] `WaitlistController` — `POST /waitlist`, `GET /waitlist/count`
- [ ] `useWaitlist.ts` composable
- [ ] `LandingView.vue` — hero, value prop, email form, feature cards, footer

---

## Backend

### Entity (`apps/api/src/waitlist/waitlist.entity.ts`)

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity()
export class Waitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column({ nullable: true })
  source: string

  @CreateDateColumn()
  createdAt: Date
}
```

### DTO (`create-waitlist.dto.ts`)

```ts
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateWaitlistDto {
  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string
}
```

### Service (`waitlist.service.ts`)

```ts
@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private repo: Repository<Waitlist>,
  ) {}

  async add(dto: CreateWaitlistDto): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Waitlist)
      .values(dto)
      .orIgnore()   // duplicate email → silent 201, not 409
      .execute()
  }

  async count(): Promise<number> {
    return this.repo.count()
  }
}
```

### Controller (`waitlist.controller.ts`)

```ts
@Controller('waitlist')
export class WaitlistController {
  constructor(private service: WaitlistService) {}

  @Post()
  @HttpCode(201)
  async add(@Body() dto: CreateWaitlistDto): Promise<void> {
    await this.service.add(dto)
  }

  @Get('count')
  async count(): Promise<{ count: number }> {
    return { count: await this.service.count() }
  }
}
```

### Module (`waitlist.module.ts`)

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Waitlist])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
```

Register in `AppModule`.

### Migration

```bash
pnpm --filter api migration:generate -- src/migrations/CreateWaitlist
pnpm --filter api migration:run
```

---

## Frontend

### Composable (`apps/web/src/composables/useWaitlist.ts`)

```ts
import { ref } from 'vue'

type State = 'idle' | 'loading' | 'success' | 'error'

export function useWaitlist() {
  const state = ref<State>('idle')
  const errorMessage = ref('')

  async function subscribe(email: string, source = 'landing') {
    state.value = 'loading'
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      if (!res.ok) throw new Error('Request failed')
      state.value = 'success'
    } catch {
      state.value = 'error'
      errorMessage.value = 'Something went wrong. Please try again.'
    }
  }

  return { state, errorMessage, subscribe }
}
```

### Landing View (`LandingView.vue`)

Structure — all sections as scoped components:

```
<LandingNav />          logo + /chat /calculator /rates links
<LandingHero />         headline, sub-headline, email form
<RateSnapshot />        single card: 30yr fixed rate (shows "--" until Phase 3)
<FeatureCards />        Chat / Calculator / Rates cards with nav links
<LandingFooter />       CFPB disclosure
```

**`LandingHero.vue`** — the most important section:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useWaitlist } from '../composables/useWaitlist'

const email = ref('')
const { state, errorMessage, subscribe } = useWaitlist()

function submit() {
  if (email.value) subscribe(email.value)
}
</script>

<template>
  <section class="...">
    <h1>The mortgage AI that works for you, not the bank.</h1>
    <p>Ask any mortgage question. Model any scenario. No lender affiliation. No conflict of interest.</p>

    <form v-if="state !== 'success'" @submit.prevent="submit">
      <input
        v-model="email"
        type="email"
        placeholder="your@email.com"
        required
        :disabled="state === 'loading'"
      />
      <button type="submit" :disabled="state === 'loading'">
        {{ state === 'loading' ? 'Joining...' : 'Get early access' }}
      </button>
      <p v-if="state === 'error'" class="text-red-500">{{ errorMessage }}</p>
    </form>

    <p v-else class="text-green-600">You're on the list.</p>
  </section>
</template>
```

**Footer disclosure** (required, non-negotiable):

```html
<footer>
  <p>
    largelanguage.mortgage is not a lender, broker, or financial advisor.
    Information provided is for educational purposes only and does not constitute
    financial advice. Always consult a licensed mortgage professional.
    <a href="https://www.consumerfinance.gov/owning-a-home/">CFPB Homebuying Resources</a>
  </p>
</footer>
```

**`RateSnapshot.vue`** — stub for now, wired in Phase 3d:

```vue
<script setup lang="ts">
import { useRatesStore } from '../stores/rates'
const ratesStore = useRatesStore()
</script>

<template>
  <div class="...">
    <span class="label">30-yr fixed</span>
    <span class="rate">{{ ratesStore.current?.['30yr_fixed']?.rate ?? '--' }}%</span>
    <span class="source">Freddie Mac / FRED</span>
  </div>
</template>
```

---

## Verification

```bash
# API
curl -X POST http://localhost:3000/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","source":"landing"}'
# → 201 (no body)

# Idempotent — same email again returns 201, not 409
curl -X POST http://localhost:3000/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'
# → 201

curl http://localhost:3000/waitlist/count
# → { "count": 1 }

# Invalid email
curl -X POST http://localhost:3000/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"email":"notanemail"}'
# → 400

# Browser: http://localhost:5173
# - Submit email form → shows "You're on the list."
# - Submit again with same email → still shows success (idempotent)
# - Rate snapshot shows "--" (expected until Phase 3d)
```

---

Next: [Phase 2b — Calculator](phase-2b-calculator.md)
