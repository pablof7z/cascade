import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import {
  parseMarketEvent,
  fetchAllMarkets,
  publishDeletionEvent,
} from '../services/marketService'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../services/nostrService', () => ({
  fetchAllMarketsTransport: vi.fn(),
  subscribeToAllCascadeMarkets: vi.fn(),
  subscribeToMarketTransport: vi.fn(),
  publishEvent: vi.fn().mockResolvedValue({}),
}))

import {
  fetchAllMarketsTransport,
  publishEvent,
} from '../services/nostrService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<{
  kind: number
  id: string
  pubkey: string
  created_at: number
  content: string
  dTag: string
  titleTag: string
  descriptionTag: string
  mintTag: string
  imageTag: string
}> = {}): NDKEvent {
  const dTag = overrides.dTag ?? 'test-market-slug'
  const titleTag = overrides.titleTag ?? 'Test Market'
  const descriptionTag = overrides.descriptionTag ?? 'A test market'
  const mintTag = overrides.mintTag ?? 'https://mint.example.com'

  return {
    kind: overrides.kind ?? 982,
    id: overrides.id ?? 'event-id-abc123def456',
    pubkey: overrides.pubkey ?? 'creator-pub-key-abcdef1234567890',
    created_at: overrides.created_at ?? 1700000000,
    content: overrides.content ?? '# Test Market\n\nDescription here.',
    getMatchingTags: (tag: string) => {
      if (tag === 'd') return dTag ? [['d', dTag]] : []
      if (tag === 'title') return titleTag ? [['title', titleTag]] : []
      if (tag === 'description') return descriptionTag ? [['description', descriptionTag]] : []
      if (tag === 'mint') return mintTag ? [['mint', mintTag]] : []
      if (tag === 'image' && overrides.imageTag) return [['image', overrides.imageTag]]
      return []
    },
  } as unknown as NDKEvent
}

// ---------------------------------------------------------------------------
// parseMarketEvent
// ---------------------------------------------------------------------------

describe('parseMarketEvent', () => {
  it('returns ok:true for a valid kind 982 event', () => {
    const event = makeEvent()
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
  })

  it('parses slug from d-tag', () => {
    const event = makeEvent({ dTag: 'my-market-slug' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.slug).toBe('my-market-slug')
  })

  it('parses eventId from event.id', () => {
    const event = makeEvent({ id: 'nostr-event-id-xyz' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.eventId).toBe('nostr-event-id-xyz')
  })

  it('parses title from title tag', () => {
    const event = makeEvent({ titleTag: 'My Custom Title' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.title).toBe('My Custom Title')
  })

  it('parses description from description tag', () => {
    const event = makeEvent({ descriptionTag: 'Custom description' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.description).toBe('Custom description')
  })

  it('parses mint from mint tag', () => {
    const event = makeEvent({ mintTag: 'https://mint.contrarian.markets' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.mint).toBe('https://mint.contrarian.markets')
  })

  it('parses image from image tag when present', () => {
    const event = makeEvent({ imageTag: 'https://example.com/banner.jpg' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.image).toBe('https://example.com/banner.jpg')
  })

  it('image is undefined when image tag absent', () => {
    const event = makeEvent()
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.image).toBeUndefined()
  })

  it('parses creatorPubkey from event.pubkey', () => {
    const event = makeEvent({ pubkey: 'my-pubkey-abc' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.creatorPubkey).toBe('my-pubkey-abc')
  })

  it('parses createdAt from event.created_at', () => {
    const event = makeEvent({ created_at: 1700000123 })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.createdAt).toBe(1700000123)
  })

  it('returns ok:false with invalid_kind for non-982 event', () => {
    const event = makeEvent({ kind: 30000 })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_kind')
  })

  it('returns ok:false with missing_d_tag when d-tag absent', () => {
    const event = makeEvent({ dTag: '' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_d_tag')
  })

  it('market has status active by default', () => {
    const event = makeEvent()
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.status).toBe('active')
  })

  it('market has default mint when mint tag absent', () => {
    const event = {
      kind: 982,
      id: 'ev-id',
      pubkey: 'pk',
      created_at: 1700000000,
      content: '',
      getMatchingTags: (tag: string) => {
        if (tag === 'd') return [['d', 'slug']]
        return []
      },
    } as unknown as NDKEvent
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.market.mint).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// fetchAllMarkets
// ---------------------------------------------------------------------------

describe('fetchAllMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed markets from valid events', async () => {
    const event = makeEvent({ id: 'mkt-event-001', dTag: 'mkt-slug-001' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([event]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('mkt-slug-001')
    expect(result[0].eventId).toBe('mkt-event-001')
  })

  it('skips events that fail parsing (non-982 kind)', async () => {
    const bad = makeEvent({ kind: 30000, dTag: 'bad-slug' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([bad]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('skips events missing d-tag', async () => {
    const bad = makeEvent({ dTag: '' })
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([bad]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(0)
  })

  it('passes the limit parameter to transport', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    await fetchAllMarkets(25)
    expect(fetchAllMarketsTransport).toHaveBeenCalledWith(25)
  })

  it('uses limit=50 by default', async () => {
    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set())
    await fetchAllMarkets()
    expect(fetchAllMarketsTransport).toHaveBeenCalledWith(50)
  })

  it('handles mixed valid/invalid events — returns only valid', async () => {
    const good = makeEvent({ dTag: 'good-slug', id: 'good-id' })
    const bad = makeEvent({ kind: 1, dTag: 'bad-slug' })

    vi.mocked(fetchAllMarketsTransport).mockResolvedValueOnce(new Set([good, bad]))

    const result = await fetchAllMarkets()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('good-slug')
  })
})

// ---------------------------------------------------------------------------
// publishDeletionEvent
// ---------------------------------------------------------------------------

describe('publishDeletionEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls publishEvent with kind 5', async () => {
    const market = {
      eventId: 'market-event-id-xyz',
      slug: 'my-market',
      title: 'Test',
      description: '',
      mint: 'https://mint.example.com',
      b: 0.0001,
      qLong: 0,
      qShort: 0,
      reserve: 0,
      participants: {},
      quotes: [],
      proofs: [],
      spentProofs: [],
      receipts: [],
      events: [],
      creatorPubkey: 'pk',
      createdAt: 1700000000,
      status: 'active' as const,
    }

    await publishDeletionEvent(market)

    expect(publishEvent).toHaveBeenCalledOnce()
    const [, tags, kind] = vi.mocked(publishEvent).mock.calls[0]
    expect(kind).toBe(5)
    const eTag = (tags as string[][]).find((t) => t[0] === 'e')
    expect(eTag).toBeDefined()
    expect(eTag![1]).toBe('market-event-id-xyz')
  })

  it('deletion event e-tag references market.eventId', async () => {
    const market = {
      eventId: 'specific-event-id',
      slug: 'market-slug',
      title: 'T',
      description: '',
      mint: 'https://mint.example.com',
      b: 0.0001,
      qLong: 0,
      qShort: 0,
      reserve: 0,
      participants: {},
      quotes: [],
      proofs: [],
      spentProofs: [],
      receipts: [],
      events: [],
      creatorPubkey: 'pk',
      createdAt: 1700000000,
      status: 'active' as const,
    }

    await publishDeletionEvent(market)

    const [, tags] = vi.mocked(publishEvent).mock.calls[0]
    const eTag = (tags as string[][]).find((t) => t[0] === 'e')
    expect(eTag![1]).toBe('specific-event-id')
  })
})
