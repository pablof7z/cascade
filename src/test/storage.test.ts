import { describe, it, expect } from 'vitest'
import type { Market } from '../market'
import type { MarketEntry } from '../storage'
import { mergeLocalAndNostr } from '../storage'

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
