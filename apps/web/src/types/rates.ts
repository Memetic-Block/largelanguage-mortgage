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
