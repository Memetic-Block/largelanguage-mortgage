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