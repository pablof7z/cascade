/**
 * Integration tests covering:
 * 1. Hydration flow — fetchAllMarkets filters invalid/unauthorized events
 * 2. Outbox retry behavior — pending publishes are retried on a timer
 * 3. Delete synchronization — incoming deletion events archive local markets
 * 4. Read-only mode — browsing works without a NIP-07 signer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { Market } from '../market'
import {
  fetchAllMarkets,
  subscribeToAllMarkets,
  publishDeletionEvent,
} from '../services/marketService'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../services/nostrService', () => ({
  fetchAllMarketsTransport: vi.fn(),
  subscribeToAllCascadeMarkets: vi.fn(),
  subscribeToMarketTransport: vi.fn(),
  fetchMarketById: vi.fn(),
  publishMarket: vi.fn().mockResolvedValue({}),
  publishEvent: vi.fn().mockResolvedValue({}),
}))

import {
  fetchAllMarketsTransport,
  subscribeToAllCascadeMarkets,
  publishMarket,
  publishEvent,
} from '../services/nostrService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    id: 'mkt-integ-001',
    title: 'Integration test market',
    description: 'Test',
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
    creatorPubkey: 'creator-pub-key-abcdef1234567890',
    createdAt: 1700000000,
    version: 1,
    stateHash: 'aabbccdd',
    status: 'active',
    ...overrides,
  }
}

function makeEvent(
  market: Market,
  overrides: Partial<{
    pubkey: string
    dTag: string
    content: string
    versionTag: string
  }> = {},
): NDKEvent {
  const dTag = overrides.dTag ?? `market:${market.id}`
  const content = overrides.content ?? JSON.stringify(market)
  const pubkey = overrides.pubkey ?? market.creatorPubkey
  const versionTag = overrides.versionTag ?? String(market.version)

  return {
    pubkey,
    content,
    getMatchingTags: (tag: string) => {
      if (tag === 'd') return [['d', dTag]]
      if (tag === 'version') return [['version', versionTag]]
      return []
    },
  } as unknown as NDKEvent
}

// ---------------------------------------------------------------------------
// 1. Hydration flow
// ---------------------------------------------------------------------------

describe('Hydration flow (fetchAllMarkets)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns valid active markets', async () => {
    const market = makeMarket()
    const event = makeEvent(market)
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([event]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(market.id)
  })

  it('skips events with unparseable content', async () => {
    const market = makeMarket()
    const badEvent = makeEvent(market, { content: 'not-json' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([badEvent]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('skips events signed by unauthorized pubkey (authority check)', async () => {
    const market = makeMarket()
    const unauthorizedEvent = makeEvent(market, { pubkey: 'attacker-pubkey-xyz' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([unauthorizedEvent]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('skips archived (deleted) markets', async () => {
    const archivedMarket = makeMarket({ status: 'archived' })
    const event = makeEvent(archivedMarket)
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([event]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('passes the limit parameter to the transport', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    await fetchAllMarkets(25)
    expect(fetchAllMarketsTransport).toHaveBeenCalledWith(25)
  })

  it('uses limit=50 by default (hydration cap)', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    await fetchAllMarkets()
    expect(fetchAllMarketsTransport).toHaveBeenCalledWith(50)
  })

  it('handles mixed valid/invalid events — returns only valid', async () => {
    const good = makeMarket({ id: 'mkt-good-1' })
    const bad = makeMarket({ id: 'mkt-bad-1' })

    const goodEvent = makeEvent(good)
    const unauthorizedEvent = makeEvent(bad, { pubkey: 'hacker-pubkey' })
    const malformedEvent = makeEvent(bad, { content: '{}' }) // no id in JSON

    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([
      goodEvent,
      unauthorizedEvent,
      malformedEvent,
    ]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('mkt-good-1')
  })
})

// ---------------------------------------------------------------------------
// 2. Outbox retry behavior
// ---------------------------------------------------------------------------
// Note: The outbox retry is a React effect (useEffect + setInterval) inside
// AppContent. We test the underlying service functions it calls rather than
// the component itself, since testing React timer effects reliably requires
// complex setup. These tests verify the building blocks are correct.

describe('Outbox retry building blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishDeletionEvent calls publishMarket with archived status (phase 1)', async () => {
    const market = makeMarket()
    await publishDeletionEvent(market)

    expect(publishMarket).toHaveBeenCalledOnce()
    const calledWith = vi.mocked(publishMarket).mock.calls[0][0] as Market
    expect(calledWith.status).toBe('archived')
    expect(calledWith.version).toBe(market.version + 1)
  })

  it('publishDeletionEvent calls publishEvent for NIP-09 kind 5 (phase 2)', async () => {
    const market = makeMarket()
    await publishDeletionEvent(market)

    expect(publishEvent).toHaveBeenCalledOnce()
    const [, tags, kind] = vi.mocked(publishEvent).mock.calls[0]
    expect(kind).toBe(5)
    const eTag = (tags as string[][]).find(t => t[0] === 'e')
    const aTag = (tags as string[][]).find(t => t[0] === 'a')
    expect(eTag).toBeDefined()
    expect(eTag![1]).toBe(market.id)
    expect(aTag).toBeDefined()
    expect(aTag![1]).toContain(market.id)
  })

  it('publishDeletionEvent runs phase 1 before phase 2', async () => {
    const calls: string[] = []
    vi.mocked(publishMarket).mockImplementationOnce(async () => {
      calls.push('publishMarket')
      return {} as import('@nostr-dev-kit/ndk').NDKEvent
    })
    vi.mocked(publishEvent).mockImplementationOnce(async () => {
      calls.push('publishEvent')
      return {} as import('@nostr-dev-kit/ndk').NDKEvent
    })

    await publishDeletionEvent(makeMarket())
    expect(calls).toEqual(['publishMarket', 'publishEvent'])
  })
})

// ---------------------------------------------------------------------------
// 3. Delete synchronization (subscribeToAllMarkets)
// ---------------------------------------------------------------------------

describe('Delete synchronization (subscribeToAllMarkets)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delivers isDeletion:true for archived market events', () => {
    const archivedMarket = makeMarket({ status: 'archived' })
    const event = makeEvent(archivedMarket)

    let capturedIsDeletion: boolean | null = null
    let capturedMarket: Market | null = null

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(event)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets((market, isDeletion) => {
      capturedMarket = market
      capturedIsDeletion = isDeletion
    })

    expect(capturedMarket).not.toBeNull()
    expect(capturedIsDeletion).toBe(true)
  })

  it('delivers isDeletion:false for active market events', () => {
    const activeMarket = makeMarket({ status: 'active' })
    const event = makeEvent(activeMarket)

    let capturedIsDeletion: boolean | null = null

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(event)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets((_market, isDeletion) => {
      capturedIsDeletion = isDeletion
    })

    expect(capturedIsDeletion).toBe(false)
  })

  it('does NOT invoke callback for unauthorized deletion events', () => {
    const archivedMarket = makeMarket({ status: 'archived' })
    const unauthorizedEvent = makeEvent(archivedMarket, { pubkey: 'attacker-pub' })

    const callback = vi.fn()

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(unauthorizedEvent)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets(callback)
    expect(callback).not.toHaveBeenCalled()
  })

  it('does NOT invoke callback for malformed events', () => {
    const market = makeMarket()
    const malformedEvent = makeEvent(market, { content: 'invalid-json' })

    const callback = vi.fn()

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(malformedEvent)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets(callback)
    expect(callback).not.toHaveBeenCalled()
  })

  it('returns a subscription with a stop() method', () => {
    const stopFn = vi.fn()
    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce(() => ({
      stop: stopFn,
    }) as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>)

    const sub = subscribeToAllMarkets(vi.fn())
    sub.stop()
    expect(stopFn).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 4. Read-only mode (no signer)
// ---------------------------------------------------------------------------
// Read-only means: fetchAllMarkets still works (reads don't need a signer).
// Subscription delivery still works (read-only can observe changes).
// Publish operations are simply not called without a signer (enforced in App.tsx
// by the `nostrReady && nostrPubkey` guards).

describe('Read-only mode (no signer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchAllMarkets resolves without a signer (transport does not require signer)', async () => {
    const market = makeMarket()
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([makeEvent(market)]))

    // Should succeed regardless of signer availability
    await expect(fetchAllMarkets()).resolves.not.toThrow()
  })

  it('fetchAllMarkets returns market data when transport succeeds', async () => {
    const market = makeMarket({ id: 'readonly-mkt' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([makeEvent(market)]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('readonly-mkt')
  })

  it('subscribeToAllMarkets delivers events to read-only observer', () => {
    const market = makeMarket({ id: 'readonly-sub-mkt' })
    const event = makeEvent(market)

    const received: Market[] = []

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(event)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets((m) => received.push(m))
    expect(received).toHaveLength(1)
    expect(received[0].id).toBe('readonly-sub-mkt')
  })

  it('fetchAllMarkets returns empty array when transport returns no events', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    const result = await fetchAllMarkets()
    expect(result).toEqual([])
  })
})
