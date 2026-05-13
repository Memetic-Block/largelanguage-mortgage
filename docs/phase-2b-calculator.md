# Phase 2b — Calculator

Build the client-side mortgage calculator. Pure TypeScript math in a composable — no API calls, zero latency. All four calculation types: amortization, scenario comparison, points break-even, rent vs buy.

## Deliverables

- [ ] `src/types/calculator.ts` — all input/output interfaces
- [ ] `src/composables/useCalculator.ts` — four math functions, fully tested
- [ ] `CalculatorView.vue` — reactive UI, three scenario tabs, four result panels

---

## Types (`apps/web/src/types/calculator.ts`)

```ts
export interface AmortizeInput {
  principal: number           // loan amount = home price - down payment
  annualRatePercent: number   // e.g. 6.875
  termYears: number           // 15 | 20 | 30
  propertyTaxAnnual?: number  // annual property tax dollars
  insuranceAnnual?: number    // annual homeowners insurance dollars
  hoaMonthly?: number
}

export interface AmortizationRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface AmortizeResult {
  monthlyPI: number       // principal + interest only
  monthlyPITI: number     // full payment incl. tax/insurance/HOA
  totalInterest: number
  totalCost: number       // principal + totalInterest
  schedule: AmortizationRow[]
}

export interface ScenarioInput extends AmortizeInput {
  label: string           // e.g. "20% down, 30yr"
}

export interface ScenarioComparison {
  scenarios: ScenarioInput[]
  results: AmortizeResult[]
}

export interface BreakEvenInput {
  loanAmount: number
  rateWithPoints: number      // lower rate, costs points
  rateWithoutPoints: number   // higher rate, no points
  pointsCost: number          // dollar amount paid for points
  termYears: number
}

export interface BreakEvenResult {
  monthsToBreakEven: number
  savingsPerMonth: number
  worthIt: boolean            // true if breakEven <= 84 months (7yr avg. stay)
  recommendation: string      // plain-English verdict
}

export interface RentVsBuyInput {
  homePrice: number
  downPayment: number
  annualRatePercent: number
  termYears: number
  propertyTaxAnnual: number
  insuranceAnnual: number
  hoaMonthly: number
  monthlyRent: number
  annualAppreciationPercent: number   // expected home appreciation
  annualInvestmentReturnPercent: number // opportunity cost of down payment
  years: number                        // comparison horizon
}

export interface RentVsBuyResult {
  monthlyPITI: number
  buyTotalOutOfPocket: number     // all payments over horizon
  buyEquityAtEnd: number          // home value - remaining loan balance
  buyNetCost: number              // outOfPocket - equityAtEnd
  rentTotalCost: number           // rent * 12 * years (simplified)
  opportunityCost: number         // what down payment would have grown to
  rentNetCost: number             // rentTotal + opportunityCost
  netBuyAdvantage: number         // positive = buy wins, negative = rent wins
  verdict: string                 // plain-English summary
}
```

---

## Composable (`apps/web/src/composables/useCalculator.ts`)

```ts
import type {
  AmortizeInput, AmortizeResult, AmortizationRow,
  ScenarioInput, ScenarioComparison,
  BreakEvenInput, BreakEvenResult,
  RentVsBuyInput, RentVsBuyResult,
} from '../types/calculator'

export function useCalculator() {

  function amortize(input: AmortizeInput): AmortizeResult {
    const { principal, annualRatePercent, termYears,
            propertyTaxAnnual = 0, insuranceAnnual = 0, hoaMonthly = 0 } = input

    const monthlyRate = annualRatePercent / 100 / 12
    const n = termYears * 12

    // Standard amortization formula
    const monthlyPI = monthlyRate === 0
      ? principal / n
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1)

    const monthlyTax = propertyTaxAnnual / 12
    const monthlyInsurance = insuranceAnnual / 12
    const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance + hoaMonthly

    const schedule: AmortizationRow[] = []
    let balance = principal

    for (let month = 1; month <= n; month++) {
      const interestPayment = balance * monthlyRate
      const principalPayment = monthlyPI - interestPayment
      balance = Math.max(0, balance - principalPayment)

      schedule.push({
        month,
        payment: round(monthlyPI),
        principal: round(principalPayment),
        interest: round(interestPayment),
        balance: round(balance),
      })
    }

    const totalInterest = round(monthlyPI * n - principal)

    return {
      monthlyPI: round(monthlyPI),
      monthlyPITI: round(monthlyPITI),
      totalInterest,
      totalCost: round(principal + totalInterest),
      schedule,
    }
  }

  function compareScenarios(scenarios: ScenarioInput[]): ScenarioComparison {
    return {
      scenarios,
      results: scenarios.map(amortize),
    }
  }

  function breakEvenPoints(input: BreakEvenInput): BreakEvenResult {
    const { loanAmount, rateWithPoints, rateWithoutPoints, pointsCost, termYears } = input

    const paymentWith = amortize({ principal: loanAmount, annualRatePercent: rateWithPoints, termYears })
    const paymentWithout = amortize({ principal: loanAmount, annualRatePercent: rateWithoutPoints, termYears })

    const savingsPerMonth = round(paymentWithout.monthlyPI - paymentWith.monthlyPI)
    const monthsToBreakEven = savingsPerMonth > 0
      ? Math.ceil(pointsCost / savingsPerMonth)
      : Infinity

    const worthIt = monthsToBreakEven <= 84

    const recommendation = savingsPerMonth <= 0
      ? 'Paying points does not reduce your payment with these inputs.'
      : worthIt
        ? `You break even in ${monthsToBreakEven} months. If you plan to stay longer than ${Math.ceil(monthsToBreakEven / 12)} years, paying points likely makes sense.`
        : `You break even in ${monthsToBreakEven} months (${(monthsToBreakEven / 12).toFixed(1)} years). Most buyers move or refinance before then — points may not be worth it.`

    return { monthsToBreakEven, savingsPerMonth, worthIt, recommendation }
  }

  function rentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
    const {
      homePrice, downPayment, annualRatePercent, termYears,
      propertyTaxAnnual, insuranceAnnual, hoaMonthly,
      monthlyRent, annualAppreciationPercent, annualInvestmentReturnPercent, years,
    } = input

    const principal = homePrice - downPayment
    const result = amortize({ principal, annualRatePercent, termYears,
                               propertyTaxAnnual, insuranceAnnual, hoaMonthly })

    const months = years * 12
    const buyTotalOutOfPocket = round(result.monthlyPITI * months + downPayment)
    const homeValueAtEnd = round(homePrice * Math.pow(1 + annualAppreciationPercent / 100, years))
    const remainingBalance = result.schedule[months - 1]?.balance ?? 0
    const buyEquityAtEnd = round(homeValueAtEnd - remainingBalance)
    const buyNetCost = round(buyTotalOutOfPocket - buyEquityAtEnd)

    const rentTotalCost = round(monthlyRent * months)
    const opportunityCost = round(
      downPayment * Math.pow(1 + annualInvestmentReturnPercent / 100, years) - downPayment
    )
    const rentNetCost = round(rentTotalCost + opportunityCost)

    const netBuyAdvantage = round(rentNetCost - buyNetCost)

    const verdict = netBuyAdvantage > 0
      ? `Over ${years} years, buying saves approximately $${netBuyAdvantage.toLocaleString()} compared to renting with these assumptions.`
      : `Over ${years} years, renting saves approximately $${Math.abs(netBuyAdvantage).toLocaleString()} compared to buying with these assumptions.`

    return {
      monthlyPITI: result.monthlyPITI,
      buyTotalOutOfPocket,
      buyEquityAtEnd,
      buyNetCost,
      rentTotalCost,
      opportunityCost,
      rentNetCost,
      netBuyAdvantage,
      verdict,
    }
  }

  return { amortize, compareScenarios, breakEvenPoints, rentVsBuy }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
```

---

## Calculator View (`CalculatorView.vue`)

Four tabs: **Amortize**, **Compare**, **Break-Even**, **Rent vs Buy**.

### Layout skeleton

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalculator } from '../composables/useCalculator'
import type { AmortizeInput, ScenarioInput, BreakEvenInput, RentVsBuyInput } from '../types/calculator'

const { amortize, compareScenarios, breakEvenPoints, rentVsBuy } = useCalculator()
const activeTab = ref<'amortize' | 'compare' | 'breakeven' | 'rentvsbuy'>('amortize')

// Amortize tab state
const amortizeInput = ref<AmortizeInput>({
  principal: 400000,
  annualRatePercent: 6.875,
  termYears: 30,
  propertyTaxAnnual: 5000,
  insuranceAnnual: 1200,
  hoaMonthly: 0,
})
const amortizeResult = computed(() => amortize(amortizeInput.value))

// Compare tab — up to 3 scenarios
const scenarios = ref<ScenarioInput[]>([
  { label: '30yr fixed', principal: 400000, annualRatePercent: 6.875, termYears: 30 },
  { label: '15yr fixed', principal: 400000, annualRatePercent: 6.25, termYears: 15 },
])
const comparison = computed(() => compareScenarios(scenarios.value))

// Break-even tab state
const breakEvenInput = ref<BreakEvenInput>({
  loanAmount: 400000, rateWithPoints: 6.5, rateWithoutPoints: 6.875,
  pointsCost: 4000, termYears: 30,
})
const breakEvenResult = computed(() => breakEvenPoints(breakEvenInput.value))

// Rent vs buy tab state
const rvbInput = ref<RentVsBuyInput>({
  homePrice: 500000, downPayment: 100000, annualRatePercent: 6.875, termYears: 30,
  propertyTaxAnnual: 5000, insuranceAnnual: 1200, hoaMonthly: 0,
  monthlyRent: 2500, annualAppreciationPercent: 3.5,
  annualInvestmentReturnPercent: 7, years: 10,
})
const rvbResult = computed(() => rentVsBuy(rvbInput.value))

const showFullSchedule = ref(false)
</script>
```

### Tab: Amortize

Show `amortizeResult` — monthly PITI breakdown (P&I / tax / insurance / HOA as labeled rows), total interest, total cost. Collapsible amortization schedule table (show first 12 rows by default, "Show all" toggle).

### Tab: Compare

Up to 3 scenarios side by side. Each column: label (editable), key inputs (rate, term, down payment), monthly PITI, total interest. "Add scenario" button (disabled at 3). Cheapest total cost highlighted.

### Tab: Break-Even

Two inputs side by side (with points / without points). Show `breakEvenResult.recommendation` as a highlighted verdict box. Color: green if `worthIt`, amber if not.

### Tab: Rent vs Buy

Input panel with all `RentVsBuyInput` fields (use sensible defaults). Results: two cost columns (Buy net cost / Rent net cost), plus a verdict box showing `rvbResult.verdict`. Note at bottom: "Assumes constant rent, no selling costs, simplified model."

---

## Verification

All verification is in the browser — no API calls to check.

```
# http://localhost:5173/calculator

Amortize tab:
- $400k loan, 6.875%, 30yr → monthly P&I ≈ $2,627
- Change rate to 6% → payment updates instantly
- Expand amortization schedule → month 1 shows most interest, month 360 shows most principal

Compare tab:
- 30yr 6.875% vs 15yr 6.25% → 15yr shows higher payment but ~$150k less total interest
- Add a third scenario → works up to 3, button disables

Break-even tab:
- $400k loan, 6.875% → 6.5% at cost of $4,000 → verify months calculation
- Set pointsCost to 0 → recommendation changes appropriately

Rent vs Buy tab:
- $500k home, $100k down, $2,500/mo rent, 10yr → shows buy/rent net costs
- Increase rent to $3,500 → buy advantage grows
- Network tab: zero API calls on any interaction
```

---

Next: [Phase 2c — LLM Integration](phase-2c-llm.md)
