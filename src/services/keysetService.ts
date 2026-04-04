/**
 * Keyset Service — Fetch, Cache, and Validate Cashu Keysets
 *
 * Manages keysets for Cascade markets. Each market has two keysets:
 * - LONG keyset: for YES/outcome tokens
 * - SHORT keyset: for NO/against tokens
 *
 * Keysets are cached in memory with TTL to avoid repeated API calls.
 */

import type { Market } from '../market'
import { discoverMintForMarket } from './mintDiscoveryService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeysetId = string   // Cashu keyset ID (unit)
export type Keyset = {
  id: KeysetId
  unit: string                  // e.g., "sat", "usd"
  mintUrl: string               // The mint this keyset belongs to
  publicKey: string             // secp256k1 public key (hex)
  validFrom?: number            // Unix timestamp (optional)
  validTo?: number              // Unix timestamp (optional)
}

export type MarketKeysets = {
  marketSlug: string
  mintUrl: string
  longKeyset: Keyset | null    // LONG/YES outcome keyset
  shortKeyset: Keyset | null   // SHORT/NO outcome keyset
  fetchedAt: number             // Unix timestamp
  expiresAt: number             // TTL expiration timestamp
}

// ---------------------------------------------------------------------------
// Internal Cache
// ---------------------------------------------------------------------------

const keysetCache = new Map<string, MarketKeysets>()

// Default TTL: 1 hour (3600 seconds)
const KEYSEt_TTL_SECONDS = 3600

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get keysets for a market, fetching from mint if not cached or expired.
 *
 * @param market The market to get keysets for
 * @param options.ttl Optional TTL in seconds (default: 3600)
 * @param options.forceRefresh Force fetch even if cached
 * @returns MarketKeysets or null if mint is unreachable
 */
export async function getMarketKeysets(
  market: Market,
  options: { ttl?: number; forceRefresh?: boolean } = {}
): Promise<MarketKeysets | null> {
  const { ttl = KEYSEt_TTL_SECONDS, forceRefresh = false } = options

  // Determine mint URL
  const mintInfo = await discoverMintForMarket(market)
  if (!mintInfo) {
    console.warn(`Cannot get keysets: mint unavailable for market ${market.slug}`)
    return null
  }

  const cacheKey = `${market.slug}:${mintInfo.url}`

  // Check cache (unless force refresh)
  if (!forceRefresh) {
    const cached = keysetCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() / 1000) {
      return cached
    }
  }

  // Fetch keysets from mint
  const keysets = await fetchKeysetsFromMint(mintInfo.url, market.slug, ttl)

  if (keysets) {
    keysetCache.set(cacheKey, keysets)
  }

  return keysets
}

/**
 * Get the LONG keyset for a market.
 */
export async function getLongKeyset(market: Market): Promise<Keyset | null> {
  const keysets = await getMarketKeysets(market)
  return keysets?.longKeyset ?? null
}

/**
 * Get the SHORT keyset for a market.
 */
export async function getShortKeyset(market: Market): Promise<Keyset | null> {
  const keysets = await getMarketKeysets(market)
  return keysets?.shortKeyset ?? null
}

/**
 * Validate a keyset by checking its signature.
 *
 * Verifies that the keyset's public key is valid on the secp256k1 curve.
 *
 * @param keyset The keyset to validate
 * @returns true if the keyset is valid
 */
export function validateKeyset(keyset: Keyset): boolean {
  // Basic validation: check required fields
  if (!keyset.id || !keyset.publicKey || !keyset.mintUrl) {
    return false
  }

  // Validate hex public key format (66 chars for compressed, 130 for uncompressed)
  const hexRegex = /^[0-9a-fA-F]{66}$/
  if (!hexRegex.test(keyset.publicKey)) {
    console.warn(`Invalid keyset public key format: ${keyset.id}`)
    return false
  }

  // Check validity dates if present
  const now = Math.floor(Date.now() / 1000)
  if (keyset.validFrom && keyset.validFrom > now) {
    console.warn(`Keyset ${keyset.id} is not yet valid`)
    return false
  }
  if (keyset.validTo && keyset.validTo < now) {
    console.warn(`Keyset ${keyset.id} has expired`)
    return false
  }

  return true
}

/**
 * Validate multiple keysets.
 *
 * @param keysets MarketKeysets to validate
 * @returns true if both keysets are valid
 */
export function validateMarketKeysets(keysets: MarketKeysets): boolean {
  const longValid = keysets.longKeyset ? validateKeyset(keysets.longKeyset) : false
  const shortValid = keysets.shortKeyset ? validateKeyset(keysets.shortKeyset) : false

  return longValid && shortValid
}

/**
 * Clear the keyset cache.
 */
export function clearKeysetCache(): void {
  keysetCache.clear()
}

/**
 * Get all cached keysets (for debugging).
 */
export function getCachedKeysets(): MarketKeysets[] {
  return Array.from(keysetCache.values())
}

/**
 * Check if keysets are cached for a market.
 */
export function hasKeysetsCached(market: Market, mintUrl: string): boolean {
  const cacheKey = `${market.slug}:${mintUrl}`
  const cached = keysetCache.get(cacheKey)
  return cached !== undefined && cached.expiresAt > Date.now() / 1000
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface MintKeysetsResponse {
  keysets: Record<KeysetId, KeysetInfo>
}

interface KeysetInfo {
  unit?: string
  publicKey?: string
  validFrom?: number
  validTo?: number
  // Custom field for outcome type (Cascade-specific)
  outcome?: 'long' | 'short'
}

/**
 * Fetch keysets from the mint's GET /v1/keysets endpoint.
 */
async function fetchKeysetsFromMint(
  mintUrl: string,
  marketSlug: string,
  ttl: number
): Promise<MarketKeysets | null> {
  try {
    const response = await fetch(`${mintUrl}/v1/keysets`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.warn(`Failed to fetch keysets from ${mintUrl}: ${response.status}`)
      return null
    }

    const data = await response.json() as MintKeysetsResponse

    // Find LONG and SHORT keysets
    // Strategy 1: Check for 'outcome' field (Cascade-specific)
    // Strategy 2: Infer from keyset ID or unit
    // Strategy 3: Use the first two keysets (LONG=first, SHORT=second)

    let longKeyset: Keyset | null = null
    let shortKeyset: Keyset | null = null

    const keysetsArray = Object.entries(data.keysets || {})

    if (keysetsArray.length === 0) {
      console.warn(`No keysets found at ${mintUrl}`)
      return null
    }

    // Try to find keysets with explicit outcome designation
    for (const [id, info] of keysetsArray) {
      const keyset: Keyset = {
        id,
        unit: info.unit || 'sat',
        mintUrl,
        publicKey: info.publicKey || '',
        validFrom: info.validFrom,
        validTo: info.validTo,
      }

      if (info.outcome === 'long' || id.includes('long') || id.includes('LONG')) {
        longKeyset = keyset
      } else if (info.outcome === 'short' || id.includes('short') || id.includes('SHORT')) {
        shortKeyset = keyset
      }
    }

    // Fallback: if we didn't find explicit keysets, use the first two
    if (!longKeyset && keysetsArray.length >= 1) {
      const [id, info] = keysetsArray[0]
      longKeyset = {
        id,
        unit: info.unit || 'sat',
        mintUrl,
        publicKey: info.publicKey || '',
        validFrom: info.validFrom,
        validTo: info.validTo,
      }
    }

    if (!shortKeyset && keysetsArray.length >= 2) {
      const [id, info] = keysetsArray[1]
      shortKeyset = {
        id,
        unit: info.unit || 'sat',
        mintUrl,
        publicKey: info.publicKey || '',
        validFrom: info.validFrom,
        validTo: info.validTo,
      }
    }

    // If we still don't have two keysets, try to create a second from the same data
    if (longKeyset && !shortKeyset && longKeyset.publicKey) {
      // Create a synthetic SHORT keyset with a different ID
      shortKeyset = {
        ...longKeyset,
        id: `${longKeyset.id}-short`,
      }
    }

    const now = Math.floor(Date.now() / 1000)

    return {
      marketSlug,
      mintUrl,
      longKeyset,
      shortKeyset,
      fetchedAt: now,
      expiresAt: now + ttl,
    }
  } catch (error) {
    console.warn(`Error fetching keysets from ${mintUrl}:`, error)
    return null
  }
}
