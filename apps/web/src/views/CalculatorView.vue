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
const showFullSchedule = ref(false)

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
</script>

<template>
  <div class="max-w-6xl mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Mortgage Calculator</h1>
    
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex space-x-8">
        <button
          @click="activeTab = 'amortize'"
          :class="{ 'border-blue-500 text-blue-600': activeTab === 'amortize' }"
          class="py-2 px-1 border-b-2 font-medium text-sm"
        >
          Amortize
        </button>
        <button
          @click="activeTab = 'compare'"
          :class="{ 'border-blue-500 text-blue-600': activeTab === 'compare' }"
          class="py-2 px-1 border-b-2 font-medium text-sm"
        >
          Compare
        </button>
        <button
          @click="activeTab = 'breakeven'"
          :class="{ 'border-blue-500 text-blue-600': activeTab === 'breakeven' }"
          class="py-2 px-1 border-b-2 font-medium text-sm"
        >
          Break-Even
        </button>
        <button
          @click="activeTab = 'rentvsbuy'"
          :class="{ 'border-blue-500 text-blue-600': activeTab === 'rentvsbuy' }"
          class="py-2 px-1 border-b-2 font-medium text-sm"
        >
          Rent vs Buy
        </button>
      </nav>
    </div>

    <!-- Amortize Tab -->
    <div v-if="activeTab === 'amortize'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Loan Details</h2>
          <div>
            <label class="block text-sm font-medium text-gray-700">Loan Amount</label>
            <input 
              v-model.number="amortizeInput.principal" 
              type="number" 
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
            <input 
              v-model.number="amortizeInput.annualRatePercent" 
              type="number" 
              step="0.001"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Loan Term (years)</label>
            <select 
              v-model.number="amortizeInput.termYears"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="15">15 years</option>
              <option value="20">20 years</option>
              <option value="30">30 years</option>
            </select>
          </div>
        </div>
        
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Additional Costs</h2>
          <div>
            <label class="block text-sm font-medium text-gray-700">Annual Property Tax</label>
            <input 
              v-model.number="amortizeInput.propertyTaxAnnual" 
              type="number" 
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Annual Insurance</label>
            <input 
              v-model.number="amortizeInput.insuranceAnnual" 
              type="number" 
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Monthly HOA Fees</label>
            <input 
              v-model.number="amortizeInput.hoaMonthly" 
              type="number" 
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Payment Breakdown</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-600">Monthly Principal & Interest</p>
            <p class="text-2xl font-bold">${{ amortizeResult.monthlyPI.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Monthly PITI (Principal, Interest, Tax, Insurance)</p>
            <p class="text-2xl font-bold">${{ amortizeResult.monthlyPITI.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Total Interest</p>
            <p class="text-xl font-bold">${{ amortizeResult.totalInterest.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Total Cost</p>
            <p class="text-xl font-bold">${{ amortizeResult.totalCost.toLocaleString() }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Amortization Schedule</h2>
          <button 
            @click="showFullSchedule = !showFullSchedule" 
            class="text-blue-600 hover:underline"
          >
            {{ showFullSchedule ? 'Show Less' : 'Show All' }}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="row in showFullSchedule ? amortizeResult.schedule : amortizeResult.schedule.slice(0, 12)" :key="row.month">
                <td class="px-6 py-4 whitespace-nowrap">{{ row.month }}</td>
                <td class="px-6 py-4 whitespace-nowrap">${{ row.payment.toLocaleString() }}</td>
                <td class="px-6 py-4 whitespace-nowrap">${{ row.principal.toLocaleString() }}</td>
                <td class="px-6 py-4 whitespace-nowrap">${{ row.interest.toLocaleString() }}</td>
                <td class="px-6 py-4 whitespace-nowrap">${{ row.balance.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Compare Tab -->
    <div v-else-if="activeTab === 'compare'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Compare Scenarios</h2>
        <div class="space-y-4">
          <div 
            v-for="(scenario, index) in scenarios" 
            :key="index"
            class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700">Scenario Label</label>
              <input 
                v-model="scenario.label" 
                type="text" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Loan Amount</label>
              <input 
                v-model.number="scenario.principal" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
              <input 
                v-model.number="scenario.annualRatePercent" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Loan Term (years)</label>
              <select 
                v-model.number="scenario.termYears"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="15">15 years</option>
                <option value="20">20 years</option>
                <option value="30">30 years</option>
              </select>
            </div>
          </div>
          <button 
            @click="scenarios.push({ label: 'New Scenario', principal: 400000, annualRatePercent: 6.875, termYears: 30 })"
            :disabled="scenarios.length >= 3"
            class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Add Scenario
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="(result, index) in comparison.results" 
          :key="index"
          :class="{ 'ring-2 ring-blue-500': comparison.results.indexOf(result) === 0 }"
          class="bg-white rounded-lg shadow p-6"
        >
          <h3 class="text-lg font-semibold mb-2">{{ scenarios[index].label }}</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Monthly PITI:</span>
              <span class="font-semibold">${{ result.monthlyPITI.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between">
              <span>Total Interest:</span>
              <span class="font-semibold">${{ result.totalInterest.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between">
              <span>Total Cost:</span>
              <span class="font-semibold">${{ result.totalCost.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Break-Even Tab -->
    <div v-else-if="activeTab === 'breakeven'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">With Points</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Loan Amount</label>
              <input 
                v-model.number="breakEvenInput.loanAmount" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Interest Rate (with points)</label>
              <input 
                v-model.number="breakEvenInput.rateWithPoints" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Without Points</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Interest Rate (without points)</label>
              <input 
                v-model.number="breakEvenInput.rateWithoutPoints" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Points Cost</label>
              <input 
                v-model.number="breakEvenInput.pointsCost" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Break-Even Analysis</h2>
        <div :class="{ 'bg-green-100': breakEvenResult.worthIt, 'bg-amber-100': !breakEvenResult.worthIt }" class="p-4 rounded">
          <p class="text-lg font-semibold">{{ breakEvenResult.recommendation }}</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-600">Months to Break Even</p>
            <p class="text-xl font-bold">{{ breakEvenResult.monthsToBreakEven === Infinity ? 'Never' : breakEvenResult.monthsToBreakEven }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-600">Monthly Savings</p>
            <p class="text-xl font-bold">${{ breakEvenResult.savingsPerMonth.toLocaleString() }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-600">Worth It?</p>
            <p class="text-xl font-bold">{{ breakEvenResult.worthIt ? 'Yes' : 'No' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Rent vs Buy Tab -->
    <div v-else-if="activeTab === 'rentvsbuy'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Home Details</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Home Price</label>
              <input 
                v-model.number="rvbInput.homePrice" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Down Payment</label>
              <input 
                v-model.number="rvbInput.downPayment" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
              <input 
                v-model.number="rvbInput.annualRatePercent" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Loan Term (years)</label>
              <select 
                v-model.number="rvbInput.termYears"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="15">15 years</option>
                <option value="20">20 years</option>
                <option value="30">30 years</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Additional Costs</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Annual Property Tax</label>
              <input 
                v-model.number="rvbInput.propertyTaxAnnual" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Annual Insurance</label>
              <input 
                v-model.number="rvbInput.insuranceAnnual" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Monthly HOA Fees</label>
              <input 
                v-model.number="rvbInput.hoaMonthly" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Rental Rate ($/mo)</label>
              <input 
                v-model.number="rvbInput.monthlyRent" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Comparison Period</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Years to Compare</label>
              <input 
                v-model.number="rvbInput.years" 
                type="number" 
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Home Appreciation (%)</label>
              <input 
                v-model.number="rvbInput.annualAppreciationPercent" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Investment Return (%)</label>
              <input 
                v-model.number="rvbInput.annualInvestmentReturnPercent" 
                type="number" 
                step="0.001"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Results</h2>
          <div class="space-y-4">
            <div class="bg-gray-50 p-4 rounded">
              <p class="text-sm text-gray-600">Buy Net Cost</p>
              <p class="text-xl font-bold">${{ rvbResult.buyNetCost.toLocaleString() }}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded">
              <p class="text-sm text-gray-600">Rent Net Cost</p>
              <p class="text-xl font-bold">${{ rvbResult.rentNetCost.toLocaleString() }}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded">
              <p class="text-sm text-gray-600">Net Advantage</p>
              <p class="text-xl font-bold" :class="{ 'text-green-600': rvbResult.netBuyAdvantage > 0, 'text-red-600': rvbResult.netBuyAdvantage < 0 }">
                ${{ Math.abs(rvbResult.netBuyAdvantage).toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Decision</h2>
        <p class="text-lg">{{ rvbResult.verdict }}</p>
      </div>
      
      <div class="text-sm text-gray-500">
        <p>Note: This is a simplified model. Assumes constant rent, no selling costs, and simplified financial assumptions.</p>
      </div>
    </div>
  </div>
</template>