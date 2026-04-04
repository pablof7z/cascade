/**
 * Mint Discovery Service
 *
 * Handles discovery and configuration of Cashu mints for Cascade markets.
 * Detects custom mints from market definitions, validates mint capabilities,
 * and manages mint info caching for the session.
 */

import type { Market } from '../market'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MintInfo = {
  url: string
  pubkey: string                   // Mint's Nostr pubkey
  name: string
  supportsCascade: boolean         // Has /v1/cascade/* endpoints
  version?: string                 // Optional mint version
  description?: string             // Optional mint description
}

// ---------------------------------------------------------------------------
// Internal cache (session-scoped)
// ---------------------------------------------------------------------------

const mintInfoCache = new Map<string, MintInfo>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover the mint to use for a given market.
 *
 * Priority:
 * 1. Market's `mint` field (from kind 982 tag)
 * 2. VITE_CASCADE_MINT_URL environment variable
 * 3. Fallback to default cascade mint
 *
 * @param market The market to discover the mint for
 * @returns MintInfo or null if mint cannot be reached
 */
export async function discoverMintForMarket(market: Market): Promise<MintInfo | null> {
  // Priority 1: Market-specific mint
  if (market.mint) {
    const info = await getMintInfo(market.mint)
    if (info) return info
  }

  // Priority 2: Environment variable
  const envMint = import.meta.env.VITE_CASCADE_MINT_URL
  if (envMint) {
    const info = await getMintInfo(envMint)
    if (info) return info
  }

  // Priority 3: Default cascade mint
  const defaultMint = 'https://mint.example.com' // TODO: Set actual default
  return getMintInfo(defaultMint)
}

/**
 * Get mint info, fetching from network if not cached.
 *
 * @param mintUrl The mint URL to get info for
 * @returns MintInfo or null if mint is unreachable or returns invalid response
 */
export async function getMintInfo(mintUrl: string): Promise<MintInfo | null> {
  // Normalize URL
  const normalizedUrl = normalizeMintUrl(mintUrl)

  // Check cache first
  const cached = mintInfoCache.get(normalizedUrl)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(`${normalizedUrl}/v1/info`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      console.warn(`Mint info request failed for ${normalizedUrl}: ${response.status}`)
      return null
    }

    const data = await response.json() as MintInfoResponse

    const mintInfo: MintInfo = {
      url: normalizedUrl,
      pubkey: data.pubkey || data.npub || '',
      name: data.name || data.mintName || extractHostFromUrl(normalizedUrl),
      supportsCascade: isCascadeMintFromResponse(data),
      version: data.version,
      description: data.description,
    }

    // Cache for session
    mintInfoCache.set(normalizedUrl, mintInfo)

    return mintInfo
  } catch (error) {
    console.warn(`Failed to fetch mint info from ${normalizedUrl}:`, error)
    return null
  }
}

/**
 * Check if a mint supports Cascade-specific endpoints.
 *
 * A mint supports Cascade if it has the custom /v1/cascade/* endpoints.
 * We detect this by checking the mint's info response for cascade-related
 * indicators (e.g., custom nuts, supported features).
 *
 * @param info The mint info to check
 * @returns true if the mint supports Cascade trading
 */
export function isCascadeMint(info: MintInfo): boolean {
  return info.supportsCascade
}

/**
 * Clear the mint info cache. Useful for refreshing mint state.
 */
export function clearMintInfoCache(): void {
  mintInfoCache.clear()
}

/**
 * Get all cached mint URLs.
 * Useful for debugging or displaying which mints have been discovered.
 */
export function getCachedMintUrls(): string[] {
  return Array.from(mintInfoCache.keys())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface MintInfoResponse {
  pubkey?: string
  npub?: string
  name?: string
  mintName?: string
  version?: string
  description?: string
  // Custom nuts or extensions that indicate Cascade support
  nuts?: Record<string, unknown>
  // Supported methods/endpoints
  methods?: string[]
  // Feature flags
  features?: {
    cascade?: boolean
    [key: string]: unknown
  }
}

/**
 * Check if the mint info response indicates Cascade support.
 */
function isCascadeMintFromResponse(data: MintInfoResponse): boolean {
  // Check for explicit cascade feature flag
  if (data.features?.cascade === true) {
    return true
  }

  // Check if methods include cascade endpoints
  if (data.methods?.some(m => m.startsWith('/v1/cascade/'))) {
    return true
  }

  // Check for custom nuts that indicate Cascade
  if (data.nuts && typeof data.nuts === 'object') {
    const nutKeys = Object.keys(data.nuts)
    if (nutKeys.some(k => k.startsWith('cascade') || k.startsWith('cascade/'))) {
      return true
    }
  }

  // Default to false - will require manual override or explicit confirmation
  return false
}

/**
 * Normalize a mint URL to ensure consistent caching and API calls.
 */
function normalizeMintUrl(url: string): string {
  let normalized = url.trim()

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  // Ensure it has a protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }

  return normalized
}

/**
 * Extract host from URL for use as fallback name.
 */
function extractHostFromUrl(url: string): string {
  try {
    const urlObj = new URL(normalizeMintUrl(url))
    return urlObj.hostname
  } catch {
    return url
  }
}
