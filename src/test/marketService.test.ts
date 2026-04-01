import { describe, it, expect } from 'vitest'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { Market } from '../market'
import {
  computeStateHash,
  serializeMarketToEvent,
  parseMarketEvent,
  validateMarketEvent,
  normalizeMarketForMigration,
  isMarketDeleted,
  ConcurrencyError,
} from '../services/marketService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    id: 'market-test-001',
    title: 'Test market',
    description: 'A test prediction market',
    b: 0.0001,
    qLong: 0,
    qShort: 0,
    reserve: 1000,
    participants: {
      you: { cash: 1000, long: 0, short: 0 },
    },
    quotes: [],
    proofs: [],
    spentProofs: [],
    receipts: [],
    events: [],
    creatorPubkey: 'creator-pub-key-abcdef1234567890',
    createdAt: 1700000000,
    version: 0,
    stateHash: '',
    status: 'active',
    ...overrides,
  }
}

function makeEvent(market: Market, overrides: Partial<{
  pubkey: string
  dTag: string
  content: string
  versionTag: string
}> = {}): NDKEvent {
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
// computeStateHash
// ---------------------------------------------------------------------------

describe('computeStateHash', () => {
  it('returns an 8-character hex string', () => {
    const market = makeMarket()
    const hash = computeStateHash(market)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic — same input gives same hash', () => {
    const market = makeMarket()
    expect(computeStateHash(market)).toBe(computeStateHash(market))
  })

  it('different LMSR state produces different hash', () => {
    const a = makeMarket({ qLong: 0, qShort: 0, reserve: 1000 })
    const b = makeMarket({ qLong: 100, qShort: 50, reserve: 900 })
    expect(computeStateHash(a)).not.toBe(computeStateHash(b))
  })

  it('metadata fields (version, title) do not affect hash', () => {
    const a = makeMarket({ version: 1, title: 'Alpha' })
    const b = makeMarket({ version: 99, title: 'Beta' })
    // Same LMSR state → same hash despite different metadata
    expect(computeStateHash(a)).toBe(computeStateHash(b))
  })
})

// ---------------------------------------------------------------------------
// serializeMarketToEvent
// ---------------------------------------------------------------------------

describe('serializeMarketToEvent', () => {
  it('includes a d-tag with market: prefix', () => {
    const market = makeMarket()
    const { tags } = serializeMarketToEvent(market)
    const dTag = tags.find(t => t[0] === 'd')
    expect(dTag).toBeDefined()
    expect(dTag![1]).toBe(`market:${market.id}`)
  })

  it('includes a c-tag with cascade value', () => {
    const market = makeMarket()
    const { tags } = serializeMarketToEvent(market)
    const cTag = tags.find(t => t[0] === 'c')
    expect(cTag![1]).toBe('cascade')
  })

  it('includes version tag', () => {
    const market = makeMarket({ version: 5 })
    const { tags } = serializeMarketToEvent(market)
    const vTag = tags.find(t => t[0] === 'version')
    expect(vTag![1]).toBe('5')
  })

  it('includes stateHash tag', () => {
    const market = makeMarket({ stateHash: 'abc12345' })
    const { tags } = serializeMarketToEvent(market)
    const hashTag = tags.find(t => t[0] === 'stateHash')
    expect(hashTag![1]).toBe('abc12345')
  })

  it('includes backup tag when backupPubkey is set', () => {
    const market = makeMarket({ backupPubkey: 'backup-key-xyz' })
    const { tags } = serializeMarketToEvent(market)
    const backupTag = tags.find(t => t[0] === 'backup')
    expect(backupTag![1]).toBe('backup-key-xyz')
  })

  it('does not include backup tag when backupPubkey is absent', () => {
    const market = makeMarket()
    const { tags } = serializeMarketToEvent(market)
    const backupTag = tags.find(t => t[0] === 'backup')
    expect(backupTag).toBeUndefined()
  })

  it('content is valid JSON encoding of the market', () => {
    const market = makeMarket()
    const { content } = serializeMarketToEvent(market)
    expect(() => JSON.parse(content)).not.toThrow()
    const parsed = JSON.parse(content)
    expect(parsed.id).toBe(market.id)
  })
})

// ---------------------------------------------------------------------------
// parseMarketEvent
// ---------------------------------------------------------------------------

describe('parseMarketEvent', () => {
  it('returns ok:true for valid event', () => {
    const market = makeMarket()
    const event = makeEvent(market)
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.market.id).toBe(market.id)
    }
  })

  it('returns ok:false with missing_d_tag when d-tag is absent', () => {
    const market = makeMarket()
    const event = {
      pubkey: market.creatorPubkey,
      content: JSON.stringify(market),
      getMatchingTags: () => [],
    } as unknown as NDKEvent

    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_d_tag')
  })

  it('returns ok:false when d-tag does not start with market:', () => {
    const market = makeMarket()
    const event = makeEvent(market, { dTag: 'post:something-else' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false with invalid_json when content is not JSON', () => {
    const market = makeMarket()
    const event = makeEvent(market, { content: 'not-valid-json' })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_json')
  })

  it('returns ok:false with invalid_market when market is missing id', () => {
    const market = makeMarket()
    const { id: _, ...marketWithoutId } = market
    const event = makeEvent(market, { content: JSON.stringify(marketWithoutId) })
    const result = parseMarketEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_market')
  })
})

// ---------------------------------------------------------------------------
// validateMarketEvent
// ---------------------------------------------------------------------------

describe('validateMarketEvent', () => {
  it('returns valid:true for event signed by creator', () => {
    const market = makeMarket()
    const event = makeEvent(market)
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.isDeletion).toBe(false)
  })

  it('returns valid:true for event signed by backupPubkey', () => {
    const market = makeMarket({ backupPubkey: 'backup-pub-key-xyz' })
    const event = makeEvent(market, { pubkey: 'backup-pub-key-xyz', versionTag: '1' })
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(true)
  })

  it('returns valid:false when signed by unauthorized pubkey', () => {
    const market = makeMarket()
    const event = makeEvent(market, { pubkey: 'unauthorized-attacker-pubkey' })
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('unauthorized')
  })

  it('returns valid:false when event has no pubkey', () => {
    const market = makeMarket()
    const event = {
      pubkey: '',
      content: JSON.stringify(market),
      getMatchingTags: (tag: string) => tag === 'd' ? [['d', `market:${market.id}`]] : [],
    } as unknown as NDKEvent
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(false)
  })

  it('returns valid:true with isDeletion:true for archived market by creator', () => {
    const market = makeMarket({ status: 'archived' })
    const event = makeEvent(market)
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.isDeletion).toBe(true)
  })

  it('returns valid:false for archived market signed by unauthorized key', () => {
    const market = makeMarket({ status: 'archived' })
    const event = makeEvent(market, { pubkey: 'unauthorized-key' })
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(false)
  })

  it('returns valid:false when backup signer attempts version rollback', () => {
    // Scenario: The market content claims version 5, but the backup signer's
    // event version tag says 2 — meaning they are re-publishing an old event.
    // eventVersion (2) < market.version (5) → rollback detected.
    const market = makeMarket({
      version: 5,
      backupPubkey: 'backup-pub-key-xyz',
    })
    const event = {
      pubkey: 'backup-pub-key-xyz',
      content: JSON.stringify(market),  // market says version 5
      getMatchingTags: (tag: string) => {
        if (tag === 'd') return [['d', `market:${market.id}`]]
        if (tag === 'version') return [['version', '2']] // tag claims old version 2
        return []
      },
    } as unknown as NDKEvent
    const result = validateMarketEvent(event)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('rollback')
  })
})

// ---------------------------------------------------------------------------
// normalizeMarketForMigration
// ---------------------------------------------------------------------------

describe('normalizeMarketForMigration', () => {
  it('adds version:0 to legacy market without version', () => {
    const legacy = makeMarket()
    const legacyWithoutVersion = { ...legacy, version: undefined } as unknown as Market
    const normalized = normalizeMarketForMigration(legacyWithoutVersion)
    expect(normalized.version).toBe(0)
  })

  it('preserves existing version', () => {
    const market = makeMarket({ version: 3 })
    const normalized = normalizeMarketForMigration(market)
    expect(normalized.version).toBe(3)
  })

  it('adds status:active to legacy market without status', () => {
    const legacy = makeMarket()
    const legacyWithoutStatus = { ...legacy, status: undefined } as unknown as Market
    const normalized = normalizeMarketForMigration(legacyWithoutStatus)
    expect(normalized.status).toBe('active')
  })

  it('preserves existing status', () => {
    const market = makeMarket({ status: 'resolved' })
    const normalized = normalizeMarketForMigration(market)
    expect(normalized.status).toBe('resolved')
  })

  it('computes stateHash when missing', () => {
    const market = makeMarket({ stateHash: '' })
    const normalized = normalizeMarketForMigration(market)
    expect(normalized.stateHash).not.toBe('')
  })

  it('preserves existing stateHash', () => {
    const market = makeMarket({ stateHash: 'deadbeef' })
    const normalized = normalizeMarketForMigration(market)
    expect(normalized.stateHash).toBe('deadbeef')
  })

  it('is idempotent — calling twice gives same result', () => {
    const market = makeMarket({ version: 2, status: 'active', stateHash: 'cafebabe' })
    const first = normalizeMarketForMigration(market)
    const second = normalizeMarketForMigration(first)
    expect(second.version).toBe(first.version)
    expect(second.status).toBe(first.status)
    expect(second.stateHash).toBe(first.stateHash)
  })
})

// ---------------------------------------------------------------------------
// isMarketDeleted
// ---------------------------------------------------------------------------

describe('isMarketDeleted', () => {
  it('returns false for active market', () => {
    expect(isMarketDeleted(makeMarket({ status: 'active' }))).toBe(false)
  })

  it('returns false for resolved market', () => {
    expect(isMarketDeleted(makeMarket({ status: 'resolved' }))).toBe(false)
  })

  it('returns true for archived market', () => {
    expect(isMarketDeleted(makeMarket({ status: 'archived' }))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ConcurrencyError
// ---------------------------------------------------------------------------

describe('ConcurrencyError', () => {
  it('is an instance of Error', () => {
    const error = new ConcurrencyError('test')
    expect(error).toBeInstanceOf(Error)
  })

  it('has name ConcurrencyError', () => {
    const error = new ConcurrencyError('test')
    expect(error.name).toBe('ConcurrencyError')
  })
})
