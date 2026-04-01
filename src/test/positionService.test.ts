import { describe, it, expect } from 'vitest'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { Position } from '../positionStore'
import {
  POSITION_EVENT_KIND,
  extractPositionIdFromDTag,
  serializePositionToEvent,
  parsePositionEvent,
  validatePositionEvent,
  computeWeightedAveragePosition,
} from '../services/positionService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-test-001',
    marketId: 'market-abc-123',
    marketTitle: 'Will ETH hit $5k?',
    direction: 'yes',
    quantity: 10,
    entryPrice: 0.6,
    costBasis: 6.0,
    timestamp: 1700000000000,
    ...overrides,
  }
}

function makePositionEvent(
  position: Position,
  overrides: Partial<{
    pubkey: string
    dTag: string
    content: string
  }> = {},
): NDKEvent {
  const dTag =
    overrides.dTag ??
    `cascade:position:${position.marketId}:${position.direction}`
  const content = overrides.content ?? JSON.stringify(position)
  const pubkey = overrides.pubkey ?? 'author-pubkey-abcdef1234567890'

  return {
    pubkey,
    content,
    getMatchingTags: (tag: string) => {
      if (tag === 'd') return [['d', dTag]]
      return []
    },
  } as unknown as NDKEvent
}

// ---------------------------------------------------------------------------
// POSITION_EVENT_KIND
// ---------------------------------------------------------------------------

describe('POSITION_EVENT_KIND', () => {
  it('is 30078', () => {
    expect(POSITION_EVENT_KIND).toBe(30078)
  })
})

// ---------------------------------------------------------------------------
// extractPositionIdFromDTag
// ---------------------------------------------------------------------------

describe('extractPositionIdFromDTag', () => {
  it('extracts marketId and direction from valid yes tag', () => {
    const result = extractPositionIdFromDTag('cascade:position:market-001:yes')
    expect(result).not.toBeNull()
    expect(result!.marketId).toBe('market-001')
    expect(result!.direction).toBe('yes')
  })

  it('extracts marketId and direction from valid no tag', () => {
    const result = extractPositionIdFromDTag('cascade:position:market-xyz:no')
    expect(result).not.toBeNull()
    expect(result!.marketId).toBe('market-xyz')
    expect(result!.direction).toBe('no')
  })

  it('returns null when prefix is missing', () => {
    expect(extractPositionIdFromDTag('position:market-001:yes')).toBeNull()
  })

  it('returns null when direction is invalid', () => {
    expect(
      extractPositionIdFromDTag('cascade:position:market-001:maybe'),
    ).toBeNull()
  })

  it('returns null when marketId is missing', () => {
    expect(extractPositionIdFromDTag('cascade:position::yes')).toBeNull()
  })

  it('returns null when there is no direction segment', () => {
    expect(
      extractPositionIdFromDTag('cascade:position:market-only'),
    ).toBeNull()
  })

  it('handles complex market IDs with hyphens and numbers', () => {
    const result = extractPositionIdFromDTag(
      'cascade:position:market-abc-123-xyz:no',
    )
    expect(result).not.toBeNull()
    expect(result!.marketId).toBe('market-abc-123-xyz')
    expect(result!.direction).toBe('no')
  })
})

// ---------------------------------------------------------------------------
// serializePositionToEvent
// ---------------------------------------------------------------------------

describe('serializePositionToEvent', () => {
  it('includes a d-tag with cascade:position prefix', () => {
    const pos = makePosition()
    const { tags } = serializePositionToEvent(pos)
    const dTag = tags.find((t) => t[0] === 'd')
    expect(dTag).toBeDefined()
    expect(dTag![1]).toBe(
      `cascade:position:${pos.marketId}:${pos.direction}`,
    )
  })

  it('includes c-tag with value cascade', () => {
    const pos = makePosition()
    const { tags } = serializePositionToEvent(pos)
    const cTag = tags.find((t) => t[0] === 'c')
    expect(cTag).toBeDefined()
    expect(cTag![1]).toBe('cascade')
  })

  it('includes v-tag with version 1', () => {
    const pos = makePosition()
    const { tags } = serializePositionToEvent(pos)
    const vTag = tags.find((t) => t[0] === 'v')
    expect(vTag).toBeDefined()
    expect(vTag![1]).toBe('1')
  })

  it('content is valid JSON encoding of the position', () => {
    const pos = makePosition()
    const { content } = serializePositionToEvent(pos)
    expect(() => JSON.parse(content)).not.toThrow()
    const parsed = JSON.parse(content)
    expect(parsed.id).toBe(pos.id)
    expect(parsed.marketId).toBe(pos.marketId)
  })

  it('d-tag reflects direction:no for no positions', () => {
    const pos = makePosition({ direction: 'no' })
    const { tags } = serializePositionToEvent(pos)
    const dTag = tags.find((t) => t[0] === 'd')
    expect(dTag![1]).toContain(':no')
  })

  it('produces consistent d-tag from marketId and direction', () => {
    const pos = makePosition({ marketId: 'abc', direction: 'yes' })
    const { tags } = serializePositionToEvent(pos)
    const dTag = tags.find((t) => t[0] === 'd')
    expect(dTag![1]).toBe('cascade:position:abc:yes')
  })
})

// ---------------------------------------------------------------------------
// parsePositionEvent
// ---------------------------------------------------------------------------

describe('parsePositionEvent', () => {
  it('returns ok:true for valid event', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos)
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.position.id).toBe(pos.id)
    }
  })

  it('returns ok:false with missing_d_tag when d-tag is absent', () => {
    const pos = makePosition()
    const event = {
      pubkey: 'test-pubkey',
      content: JSON.stringify(pos),
      getMatchingTags: () => [],
    } as unknown as NDKEvent
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_d_tag')
  })

  it('returns ok:false when d-tag does not start with cascade:position:', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, { dTag: 'market:some-other-thing' })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_d_tag')
  })

  it('returns ok:false with invalid_json when content is not JSON', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, { content: 'not-valid-json' })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_json')
  })

  it('returns ok:false with invalid_position when id is missing', () => {
    const pos = makePosition()
    const { id: _, ...posWithoutId } = pos
    const event = makePositionEvent(pos, {
      content: JSON.stringify(posWithoutId),
    })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_position')
  })

  it('returns ok:false when marketId is missing', () => {
    const pos = makePosition()
    const { marketId: _, ...rest } = pos
    const event = makePositionEvent(pos, { content: JSON.stringify(rest) })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when direction is invalid', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, {
      content: JSON.stringify({ ...pos, direction: 'long' }),
    })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_position')
  })

  it('returns ok:false when quantity is missing', () => {
    const pos = makePosition()
    const { quantity: _, ...rest } = pos
    const event = makePositionEvent(pos, { content: JSON.stringify(rest) })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when entryPrice is missing', () => {
    const pos = makePosition()
    const { entryPrice: _, ...rest } = pos
    const event = makePositionEvent(pos, { content: JSON.stringify(rest) })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when costBasis is missing', () => {
    const pos = makePosition()
    const { costBasis: _, ...rest } = pos
    const event = makePositionEvent(pos, { content: JSON.stringify(rest) })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when timestamp is missing', () => {
    const pos = makePosition()
    const { timestamp: _, ...rest } = pos
    const event = makePositionEvent(pos, { content: JSON.stringify(rest) })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when d-tag has invalid direction segment', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, {
      dTag: 'cascade:position:market-001:up',
    })
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_d_tag')
  })

  it('round-trips through serialization', () => {
    const pos = makePosition()
    const { content, tags } = serializePositionToEvent(pos)
    const dTag = tags.find((t) => t[0] === 'd')!
    const event = {
      pubkey: 'test-pubkey',
      content,
      getMatchingTags: (tag: string) => {
        if (tag === 'd') return [dTag]
        return []
      },
    } as unknown as NDKEvent
    const result = parsePositionEvent(event)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.position.id).toBe(pos.id)
      expect(result.position.marketId).toBe(pos.marketId)
      expect(result.position.direction).toBe(pos.direction)
      expect(result.position.quantity).toBe(pos.quantity)
    }
  })
})

// ---------------------------------------------------------------------------
// validatePositionEvent
// ---------------------------------------------------------------------------

describe('validatePositionEvent', () => {
  it('returns valid:true for well-formed event', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos)
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(true)
  })

  it('returns valid:false when pubkey is absent', () => {
    const pos = makePosition()
    const event = {
      pubkey: '',
      content: JSON.stringify(pos),
      getMatchingTags: (tag: string) => {
        if (tag === 'd')
          return [['d', `cascade:position:${pos.marketId}:${pos.direction}`]]
        return []
      },
    } as unknown as NDKEvent
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('pubkey')
  })

  it('returns valid:false when d-tag is missing', () => {
    const pos = makePosition()
    const event = {
      pubkey: 'test-pubkey',
      content: JSON.stringify(pos),
      getMatchingTags: () => [],
    } as unknown as NDKEvent
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(false)
  })

  it('returns valid:false when d-tag prefix is wrong', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, { dTag: 'other:market:yes' })
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(false)
  })

  it('returns valid:false when content is invalid JSON', () => {
    const pos = makePosition()
    const event = makePositionEvent(pos, { content: '{not-json' })
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(false)
  })

  it('accepts positions with direction "no"', () => {
    const pos = makePosition({ direction: 'no' })
    const event = makePositionEvent(pos)
    const result = validatePositionEvent(event)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeWeightedAveragePosition
// ---------------------------------------------------------------------------

describe('computeWeightedAveragePosition', () => {
  it('returns existing position unchanged when newQty is 0', () => {
    const pos = makePosition({ quantity: 10, entryPrice: 0.5 })
    const result = computeWeightedAveragePosition(pos, 0, 0.8)
    expect(result).toStrictEqual(pos)
  })

  it('computes correct weighted average for equal quantities', () => {
    const pos = makePosition({ quantity: 10, entryPrice: 0.4 })
    const result = computeWeightedAveragePosition(pos, 10, 0.6)
    // (0.4 * 10 + 0.6 * 10) / 20 = 10 / 20 = 0.5
    expect(result.quantity).toBe(20)
    expect(result.entryPrice).toBeCloseTo(0.5)
    expect(result.costBasis).toBeCloseTo(10.0)
  })

  it('correctly weights larger existing position', () => {
    const pos = makePosition({ quantity: 90, entryPrice: 0.3 })
    const result = computeWeightedAveragePosition(pos, 10, 0.9)
    // (0.3 * 90 + 0.9 * 10) / 100 = (27 + 9) / 100 = 0.36
    expect(result.quantity).toBe(100)
    expect(result.entryPrice).toBeCloseTo(0.36)
  })

  it('handles degenerate case: existing quantity is 0', () => {
    const pos = makePosition({ quantity: 0, entryPrice: 0.0, costBasis: 0.0 })
    const result = computeWeightedAveragePosition(pos, 5, 0.7)
    expect(result.quantity).toBe(5)
    expect(result.entryPrice).toBe(0.7)
    expect(result.costBasis).toBe(3.5)
  })

  it('preserves all non-quantity fields from existing position', () => {
    const pos = makePosition({
      id: 'preserved-id',
      marketId: 'preserved-market',
      direction: 'no',
    })
    const result = computeWeightedAveragePosition(pos, 5, 0.5)
    expect(result.id).toBe('preserved-id')
    expect(result.marketId).toBe('preserved-market')
    expect(result.direction).toBe('no')
  })

  it('updates timestamp on merge', () => {
    const before = Date.now()
    const pos = makePosition({ quantity: 10, entryPrice: 0.5, timestamp: 1000 })
    const result = computeWeightedAveragePosition(pos, 5, 0.8)
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
    expect(result.timestamp).toBeGreaterThan(1000)
  })

  it('costBasis equals entryPrice * quantity after merge', () => {
    const pos = makePosition({ quantity: 5, entryPrice: 0.4 })
    const result = computeWeightedAveragePosition(pos, 5, 0.6)
    expect(result.costBasis).toBeCloseTo(result.entryPrice * result.quantity)
  })

  it('treats negative existing quantity as degenerate — resets to new values', () => {
    // existing.quantity <= 0 → treated as zero, new position wins entirely
    const pos = makePosition({ quantity: -5, entryPrice: 0.5 })
    const result = computeWeightedAveragePosition(pos, 10, 0.7)
    expect(result.quantity).toBe(10)
    expect(result.entryPrice).toBe(0.7)
    expect(result.costBasis).toBeCloseTo(7.0)
  })
})
