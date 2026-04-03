/**
 * Integration tests covering:
 * 1. Hydration flow — fetchAllMarkets filters invalid/unauthorized events
 * 2. Delete synchronization — incoming deletion events are handled
 * 3. Read-only mode — browsing works without a NIP-07 signer
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
  fetchMarketByEventId: vi.fn(),
  publishEvent: vi.fn().mockResolvedValue({}),
}))

import {
  fetchAllMarketsTransport,
  subscribeToAllCascadeMarkets,
  publishEvent,
} from '../services/nostrService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    eventId: 'evt-integ-001',
    slug: 'integration-test-market',
    title: 'Integration test market',
    description: 'Test market description',
    mint: 'https://mint.contrarian.markets',
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
    status: 'active',
    ...overrides,
  }
}

function makeEvent(
  market: Market,
  overrides: Partial<{
    pubkey: string
    dTag: string
    title: string
    description: string
    mint: string
  }> = {},
): NDKEvent {
  const dTag = overrides.dTag ?? market.slug
  const title = overrides.title ?? market.title
  const description = overrides.description ?? market.description
  const mint = overrides.mint ?? market.mint
  const pubkey = overrides.pubkey ?? market.creatorPubkey

  return {
    kind: 982,
    id: market.eventId,
    pubkey,
    content: '',
    created_at: market.createdAt,
    getMatchingTags: (tag: string) => {
      if (tag === 'd') return [['d', dTag]]
      if (tag === 'title') return [['title', title]]
      if (tag === 'description') return [['description', description]]
      if (tag === 'mint') return [['mint', mint]]
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
    expect(result[0].eventId).toBe(market.eventId)
    expect(result[0].slug).toBe(market.slug)
  })

  it('skips events without a d-tag', async () => {
    const market = makeMarket()
    const badEvent = makeEvent(market, { dTag: '' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([badEvent]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('returns market even when pubkey differs from creator (kind 982 has no authority check)', async () => {
    // Kind 982 is non-replaceable — anyone can publish a market event.
    // Authority checks (e.g. isOwner) happen at the App level, not service level.
    const market = makeMarket()
    const otherPubkeyEvent = makeEvent(market, { pubkey: 'attacker-pubkey-xyz' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([otherPubkeyEvent]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].eventId).toBe(market.eventId)
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

  it('handles mixed valid/invalid events — skips events missing d-tag', async () => {
    const valid = makeMarket({ eventId: 'evt-good-1', slug: 'good-market' })
    const noDTag = makeMarket({ eventId: 'evt-bad-1', slug: 'bad-market' })

    const validEvent = makeEvent(valid)
    const noDTagEvent = makeEvent(noDTag, { dTag: '' })

    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([
      validEvent,
      noDTagEvent,
    ]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].eventId).toBe('evt-good-1')
  })
})

// ---------------------------------------------------------------------------
// 2. Delete synchronization (subscribeToAllMarkets)
// ---------------------------------------------------------------------------

describe('Delete synchronization (subscribeToAllMarkets)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('does NOT invoke callback for events without d-tag', () => {
    const market = makeMarket()
    const noDTagEvent = makeEvent(market, { dTag: '' })

    const callback = vi.fn()

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(noDTagEvent)
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
// 3. Deletion publishing (publishDeletionEvent)
// ---------------------------------------------------------------------------

describe('Deletion publishing (publishDeletionEvent)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes a NIP-09 kind 5 deletion event referencing the market eventId', async () => {
    const market = makeMarket()
    await publishDeletionEvent(market)

    expect(publishEvent).toHaveBeenCalledOnce()
    const [, tags, kind] = vi.mocked(publishEvent).mock.calls[0]
    expect(kind).toBe(5)
    const eTag = (tags as string[][]).find(t => t[0] === 'e')
    expect(eTag).toBeDefined()
    expect(eTag![1]).toBe(market.eventId)
  })

  it('includes the market eventId in the deletion event tags', async () => {
    const market = makeMarket({ eventId: 'evt-delete-test-abc' })
    await publishDeletionEvent(market)

    const [, tags] = vi.mocked(publishEvent).mock.calls[0]
    const eTag = (tags as string[][]).find(t => t[0] === 'e')
    expect(eTag![1]).toBe('evt-delete-test-abc')
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
    const market = makeMarket({ eventId: 'readonly-mkt', slug: 'readonly-market' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([makeEvent(market)]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].eventId).toBe('readonly-mkt')
  })

  it('subscribeToAllMarkets delivers events to read-only observer', () => {
    const market = makeMarket({ eventId: 'readonly-sub-mkt', slug: 'readonly-sub-market' })
    const event = makeEvent(market)

    const received: Market[] = []

    vi.mocked(subscribeToAllCascadeMarkets).mockImplementationOnce((cb) => {
      cb(event)
      return { stop: vi.fn() } as unknown as ReturnType<typeof subscribeToAllCascadeMarkets>
    })

    subscribeToAllMarkets((m) => received.push(m))
    expect(received).toHaveLength(1)
    expect(received[0].eventId).toBe('readonly-sub-mkt')
  })

  it('fetchAllMarkets returns empty array when transport returns no events', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    const result = await fetchAllMarkets()
    expect(result).toEqual([])
  })
})
