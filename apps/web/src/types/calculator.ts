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