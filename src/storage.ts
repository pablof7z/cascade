import type { Market } from './market'
import type { HistoryPoint } from './PriceChart'

export type MarketEntry = { market: Market; history: HistoryPoint[] }

const STORAGE_KEY = 'cascade-markets'

export function load(): Record<string, MarketEntry> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, MarketEntry>
  } catch {
    return null
  }
}

export function save(markets: Record<string, MarketEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markets))
  } catch {
    // quota exceeded — silently ignore
  }
}
