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