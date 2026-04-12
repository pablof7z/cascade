import type { Market } from './market'
import type { HistoryPoint } from './PriceChart'
import { parseMarketEvent } from './services/marketService'

export type MarketEntry = { market: Market; history: HistoryPoint[] }

const STORAGE_KEY = 'cascade-markets'
const PENDING_KEY = 'cascade-pending-publishes'

// ---------------------------------------------------------------------------
// Core load/save (synchronous — used in initState)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Offline outbox — persisted queue of markets waiting to be published
// ---------------------------------------------------------------------------

export interface PendingPublish {
  marketId: string
  market: Market
  createdAt: number
  retries: number
}

export function getPendingPublishes(): PendingPublish[] {
  try {
    const stored = localStorage.getItem(PENDING_KEY)
    return stored ? (JSON.parse(stored) as PendingPublish[]) : []
  } catch {
    return []
  }
}

export function addPendingPublish(market: Market): void {
  const pending = getPendingPublishes()
  // Replace existing entry for this market if present (idempotent)
  const filtered = pending.filter((p) => p.marketId !== market.slug)
  filtered.push({
    marketId: market.slug,
    market,
    createdAt: Date.now(),
    retries: 0,
  })
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(filtered))
  } catch {
    // quota exceeded — silently ignore
  }
}

export function removePendingPublish(marketId: string): void {
  const pending = getPendingPublishes()
  const filtered = pending.filter((p) => p.marketId !== marketId)
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}

export function incrementPendingRetries(marketId: string): void {
  const pending = getPendingPublishes()
  const target = pending.find((p) => p.marketId === marketId)
  if (target) {
    target.retries++
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Merge — combine localStorage state with Nostr-fetched markets
// Kind 982 events are immutable — use createdAt for tie-breaking.
// Newer createdAt wins; if equal, keep local.
// ---------------------------------------------------------------------------

export function mergeLocalAndNostr(
  local: Record<string, MarketEntry>,
  nostrMarkets: Market[],
): Record<string, MarketEntry> {
  const merged: Record<string, MarketEntry> = { ...local }

  for (const nostrMarket of nostrMarkets) {
    const localEntry = merged[nostrMarket.slug]

    if (!localEntry) {
      // New market discovered on Nostr — add it
      merged[nostrMarket.slug] = {
        market: nostrMarket,
        history: [],
      }
      continue
    }

    const localTimestamp = localEntry.market.createdAt ?? 0
    const nostrTimestamp = nostrMarket.createdAt ?? 0

    // Newer timestamp wins; if equal, keep local
    if (nostrTimestamp > localTimestamp) {
      merged[nostrMarket.slug] = {
        market: nostrMarket,
        history: localEntry.history, // Preserve local history for chart continuity
      }
    }
    // Else keep local
  }

  return merged
}

// ---------------------------------------------------------------------------
// Merge from raw NDKEvents (convenience wrapper used during hydration)
// ---------------------------------------------------------------------------

import type { NDKEvent } from '@nostr-dev-kit/ndk'

export function mergeLocalAndNostrEvents(
  local: Record<string, MarketEntry>,
  nostrEvents: Set<NDKEvent>,
): Record<string, MarketEntry> {
  const markets: Market[] = []
  for (const event of nostrEvents) {
    const result = parseMarketEvent(event)
    if (result.ok && result.market.status !== 'archived') {
      markets.push(result.market)
    }
  }
  return mergeLocalAndNostr(local, markets)
}
