import { describe, it, expect, beforeEach } from 'vitest'
import type { Market } from '../market'
import type { MarketEntry } from '../storage'
import { mergeLocalAndNostr } from '../storage'
import {
  loadPositions,
  savePositions,
  addPosition,
  removePosition,
  getPositionsForMarket,
} from '../positionStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarket(id: string, overrides: Partial<Market> = {}): Market {
  return {
    id,
    title: `Market ${id}`,
    description: 'Test market',
    b: 0.0001,
    qLong: 0,
    qShort: 0,
    reserve: 1000,
    participants: { you: { cash: 1000, long: 0, short: 0 } },
    quotes: [],
    proofs: [],
    spentProofs: [],
    receipts: [],
    events: [],
    creatorPubkey: 'creator-key',
    createdAt: 1700000000,
    version: 0,
    stateHash: 'aabbccdd',
    status: 'active',
    ...overrides,
  }
}

function makeEntry(market: Market): MarketEntry {
  return { market, history: [] }
}

// ---------------------------------------------------------------------------
// mergeLocalAndNostr
// ---------------------------------------------------------------------------

describe('mergeLocalAndNostr', () => {
  it('adds a new Nostr market not in local state', () => {
    const local: Record<string, MarketEntry> = {}
    const nostr = [makeMarket('mkt-new')]
    const result = mergeLocalAndNostr(local, nostr)
    expect(result['mkt-new']).toBeDefined()
    expect(result['mkt-new'].market.id).toBe('mkt-new')
    expect(result['mkt-new'].history).toEqual([])
  })

  it('keeps local market when it has higher version', () => {
    const localMarket = makeMarket('mkt-1', { version: 5, reserve: 900 })
    const local = { 'mkt-1': makeEntry(localMarket) }
    const nostrMarket = makeMarket('mkt-1', { version: 3, reserve: 1000 })
    const result = mergeLocalAndNostr(local, [nostrMarket])
    // Local wins (higher version)
    expect(result['mkt-1'].market.version).toBe(5)
    expect(result['mkt-1'].market.reserve).toBe(900)
  })

  it('uses Nostr market when it has higher version', () => {
    const localMarket = makeMarket('mkt-1', { version: 2, reserve: 1000 })
    const local = { 'mkt-1': makeEntry(localMarket) }
    const nostrMarket = makeMarket('mkt-1', { version: 7, reserve: 850 })
    const result = mergeLocalAndNostr(local, [nostrMarket])
    // Nostr wins (higher version)
    expect(result['mkt-1'].market.version).toBe(7)
    expect(result['mkt-1'].market.reserve).toBe(850)
  })

  it('preserves local history when Nostr market wins', () => {
    const localMarket = makeMarket('mkt-1', { version: 1 })
    const history = [{ time: 1700000001, priceLong: 0.55, reserve: 990 }]
    const local = { 'mkt-1': { market: localMarket, history } }
    const nostrMarket = makeMarket('mkt-1', { version: 3 })
    const result = mergeLocalAndNostr(local, [nostrMarket])
    // History from local is preserved even when Nostr market data wins
    expect(result['mkt-1'].history).toBe(history)
  })

  it('uses Nostr market when same version but later createdAt', () => {
    const localMarket = makeMarket('mkt-1', { version: 1, createdAt: 1700000000 })
    const local = { 'mkt-1': makeEntry(localMarket) }
    const nostrMarket = makeMarket('mkt-1', { version: 1, createdAt: 1700000100 })
    const result = mergeLocalAndNostr(local, [nostrMarket])
    expect(result['mkt-1'].market.createdAt).toBe(1700000100)
  })

  it('keeps local market when same version and same timestamp', () => {
    const localMarket = makeMarket('mkt-1', { version: 1, createdAt: 1700000000, reserve: 999 })
    const local = { 'mkt-1': makeEntry(localMarket) }
    const nostrMarket = makeMarket('mkt-1', { version: 1, createdAt: 1700000000, reserve: 888 })
    const result = mergeLocalAndNostr(local, [nostrMarket])
    // Local unchanged (same version + same timestamp → no replacement)
    expect(result['mkt-1'].market.reserve).toBe(999)
  })

  it('handles multiple Nostr markets correctly', () => {
    const local = { 'mkt-a': makeEntry(makeMarket('mkt-a', { version: 1 })) }
    const nostr = [
      makeMarket('mkt-a', { version: 3 }),
      makeMarket('mkt-b'),
      makeMarket('mkt-c'),
    ]
    const result = mergeLocalAndNostr(local, nostr)
    expect(Object.keys(result)).toHaveLength(3)
    expect(result['mkt-a'].market.version).toBe(3)
    expect(result['mkt-b']).toBeDefined()
    expect(result['mkt-c']).toBeDefined()
  })

  it('does not include local-only markets in the result (they are preserved)', () => {
    const local = {
      'mkt-local': makeEntry(makeMarket('mkt-local')),
    }
    const nostr = [makeMarket('mkt-nostr')]
    const result = mergeLocalAndNostr(local, nostr)
    // Local-only market is preserved
    expect(result['mkt-local']).toBeDefined()
    expect(result['mkt-nostr']).toBeDefined()
  })

  it('returns empty object when both inputs are empty', () => {
    const result = mergeLocalAndNostr({}, [])
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// positionStore adapter — localStorage mode (anonymous user)
// ---------------------------------------------------------------------------

describe('positionStore adapter (anonymous / localStorage)', () => {
  // Reset cache to empty state before each test via savePositions
  beforeEach(() => {
    savePositions([])
  })

  it('loadPositions returns empty array initially', () => {
    expect(loadPositions()).toEqual([])
  })

  it('addPosition creates a new position with correct fields', () => {
    const pos = addPosition('market-1', 'Test Market', 'yes', 5, 0.6)
    expect(pos.marketId).toBe('market-1')
    expect(pos.marketTitle).toBe('Test Market')
    expect(pos.direction).toBe('yes')
    expect(pos.quantity).toBe(5)
    expect(pos.entryPrice).toBe(0.6)
    expect(pos.costBasis).toBeCloseTo(3.0)
    expect(pos.id).toBeTruthy()
    expect(pos.timestamp).toBeGreaterThan(0)
  })

  it('addPosition merges into existing position on same market+direction', () => {
    addPosition('market-2', 'Market Two', 'no', 10, 0.4)
    const merged = addPosition('market-2', 'Market Two', 'no', 10, 0.6)
    // Weighted average: (0.4*10 + 0.6*10) / 20 = 0.5
    expect(merged.quantity).toBe(20)
    expect(merged.entryPrice).toBeCloseTo(0.5)
    const all = loadPositions()
    // Only one entry for this market+direction
    const forMarket = all.filter((p) => p.marketId === 'market-2')
    expect(forMarket).toHaveLength(1)
  })

  it('getPositionsForMarket returns only positions for that market', () => {
    addPosition('mkt-a', 'Market A', 'yes', 5, 0.5)
    addPosition('mkt-b', 'Market B', 'no', 3, 0.7)
    const result = getPositionsForMarket('mkt-a')
    expect(result).toHaveLength(1)
    expect(result[0].marketId).toBe('mkt-a')
  })

  it('removePosition removes the position by id', () => {
    const pos = addPosition('mkt-del', 'Delete Market', 'yes', 2, 0.8)
    removePosition(pos.id)
    expect(loadPositions().find((p) => p.id === pos.id)).toBeUndefined()
  })
})
