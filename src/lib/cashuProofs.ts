/**
 * Cashu Proofs Library
 *
 * Helper functions for working with Cashu proofs.
 * Proofs are the core unit of Cashu ecash - signed tokens that can be
 * redeemed by anyone who holds them (bearer instruments).
 *
 * These helpers are used throughout the trading flow:
 * - Trade execution: spend proofs from wallet, receive new proofs from mint
 * - Redemption: collect proofs for a market, redeem for payout
 * - Settlement: redeem final outcome tokens after resolution
 */

import type { Market, Side } from '../market'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CashuProof = {
  id: string            // Proof ID (reveal)
  secret: string        // Secret (blinded message)
  amount: number        // Value in sats
  keyset: string       // Keyset ID this proof belongs to
  C?: string           // Additional randomness commitment
  witness?: string     // Witness data (e.g., DLEQ proof)
}

export type CashuProofs = CashuProof[]

export type ProofSelection = {
  proofs: CashuProof[]
  total: number
  surplus: number  // Amount above what was needed (change)
}

// ---------------------------------------------------------------------------
// Proof Selection
// ---------------------------------------------------------------------------

/**
 * Select proofs from a set to cover at least the target amount.
 * Uses a greedy algorithm (largest proofs first).
 *
 * @param proofs Array of available proofs
 * @param target Amount to cover in sats
 * @returns Selected proofs or null if not enough balance
 */
export function selectProofsForAmount(
  proofs: CashuProof[],
  target: number,
): ProofSelection | null {
  if (proofs.length === 0 || target <= 0) {
    return null
  }

  // Sort by amount descending (greedy: largest first)
  const sorted = [...proofs].sort((a, b) => b.amount - a.amount)

  const selected: CashuProof[] = []
  let total = 0

  for (const proof of sorted) {
    selected.push(proof)
    total += proof.amount
    if (total >= target) {
      break
    }
  }

  if (total < target) {
    return null  // Not enough balance
  }

  return {
    proofs: selected,
    total,
    surplus: total - target,  // Change to return
  }
}

/**
 * Group proofs by keyset ID.
 *
 * @param proofs Array of proofs
 * @returns Map of keyset ID -> proofs
 */
export function groupProofsByKeyset(proofs: CashuProof[]): Map<string, CashuProof[]> {
  const grouped = new Map<string, CashuProof[]>()
  for (const proof of proofs) {
    const keyset = proof.keyset || 'unknown'
    if (!grouped.has(keyset)) {
      grouped.set(keyset, [])
    }
    grouped.get(keyset)!.push(proof)
  }
  return grouped
}

/**
 * Get total value of proofs.
 *
 * @param proofs Array of proofs
 * @returns Total value in sats
 */
export function getProofsTotal(proofs: CashuProof[]): number {
  return proofs.reduce((sum, p) => sum + p.amount, 0)
}

// ---------------------------------------------------------------------------
// Proof Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single proof.
 *
 * @param proof Proof to validate
 * @returns true if valid
 */
export function isValidProof(proof: CashuProof): boolean {
  if (!proof.id || !proof.secret) {
    return false
  }
  if (typeof proof.amount !== 'number' || proof.amount <= 0) {
    return false
  }
  if (!Number.isFinite(proof.amount)) {
    return false
  }
  return true
}

/**
 * Validate an array of proofs.
 *
 * @param proofs Array of proofs to validate
 * @returns Array of invalid proof indices (empty if all valid)
 */
export function findInvalidProofs(proofs: CashuProof[]): number[] {
  const invalid: number[] = []
  for (let i = 0; i < proofs.length; i++) {
    if (!isValidProof(proofs[i])) {
      invalid.push(i)
    }
  }
  return invalid
}

// ---------------------------------------------------------------------------
// Proof Matching for Trading
// ---------------------------------------------------------------------------

/**
 * Find proofs that match a specific keyset.
 * Used when trading requires proofs from a specific keyset (e.g., LONG or SHORT).
 *
 * @param proofs Available proofs
 * @param keyset Keyset ID to match
 * @returns Proofs matching the keyset
 */
export function findProofsByKeyset(proofs: CashuProof[], keyset: string): CashuProof[] {
  return proofs.filter(p => p.keyset === keyset)
}

/**
 * Check if there are enough proofs for a trade.
 *
 * @param proofs Available proofs
 * @param keyset Keyset required for trade
 * @param amount Amount needed
 * @returns true if trade is possible
 */
export function canSpendForTrade(
  proofs: CashuProof[],
  keyset: string,
  amount: number,
): boolean {
  const keysetProofs = findProofsByKeyset(proofs, keyset)
  const selection = selectProofsForAmount(keysetProofs, amount)
  return selection !== null
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize proofs to a Cashu token string.
 * Format: base64-encoded JSON with token version prefix.
 *
 * @param proofs Array of proofs
 * @param mintUrl Mint URL (for token context)
 * @returns Token string
 */
export function serializeProofs(proofs: CashuProof[], mintUrl: string): string {
  const token = {
    token: [
      {
        mint: mintUrl,
        proofs,
      },
    ],
  }
  return btoa(JSON.stringify(token))
}

/**
 * Deserialize a Cashu token string to proofs.
 *
 * @param tokenString Cashu token string
 * @returns Tuple of [mintUrl, proofs] or null if invalid
 */
export function deserializeProofs(
  tokenString: string,
): [mintUrl: string, proofs: CashuProof[]] | null {
  try {
    // Try base64 first
    let parsed: unknown
    try {
      parsed = JSON.parse(atob(tokenString))
    } catch {
      // Try JSON directly (some tokens are plain JSON)
      parsed = JSON.parse(tokenString)
    }

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const obj = parsed as Record<string, unknown>
    const tokenArray = obj.token as Array<{ mint?: string; proofs?: CashuProof[] }> | undefined

    if (!Array.isArray(tokenArray) || tokenArray.length === 0) {
      return null
    }

    const first = tokenArray[0]
    if (!first || !Array.isArray(first.proofs)) {
      return null
    }

    const mintUrl = first.mint || ''
    return [mintUrl, first.proofs as CashuProof[]]
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Trade Proof Operations
// ---------------------------------------------------------------------------

/**
 * Extract proofs from a Cashu token for a specific market keyset.
 * Used in the trading flow to identify which proofs to send.
 *
 * @param tokenString Serialized Cashu token
 * @param keyset Keyset to filter proofs by
 * @returns Proofs matching the keyset, or all proofs if keyset not found
 */
export function extractProofsForKeyset(
  tokenString: string,
  keyset: string,
): CashuProof[] {
  const deserialized = deserializeProofs(tokenString)
  if (!deserialized) {
    return []
  }

  const [, proofs] = deserialized
  const keysetProofs = findProofsByKeyset(proofs, keyset)

  // If no proofs match the keyset, return all (mint will handle routing)
  return keysetProofs.length > 0 ? keysetProofs : proofs
}

/**
 * Create a proof spending request for the mint.
 * This is the payload sent to POST /v1/cascade/trade.
 *
 * @param proofs Proofs to spend
 * @param marketSlug Market slug for routing
 * @param side Trade side (LONG or SHORT)
 * @param amountSats Amount to spend
 * @returns Spending request payload
 */
export interface TradeSpendingRequest {
  proofs: CashuProof[]
  market: string
  side: Side
  amount: number  // in sats
}

/**
 * Calculate the fee for a trade.
 * Currently 1% rake as per product spec.
 *
 * @param amount Trade amount in sats
 * @param feePercent Fee percentage (default 1%)
 * @returns Fee amount in sats
 */
export function calculateTradeFee(amount: number, feePercent: number = 1): number {
  return Math.ceil(amount * (feePercent / 100))
}

/**
 * Calculate the net amount after fee.
 *
 * @param amount Trade amount in sats
 * @param feePercent Fee percentage (default 1%)
 * @returns Net amount after fee
 */
export function calculateNetAmount(amount: number, feePercent: number = 1): number {
  return amount - calculateTradeFee(amount, feePercent)
}

/**
 * Get the keyset for a specific trade side.
 * In Cascade, each market has two keysets: LONG and SHORT.
 *
 * @param market The market
 * @param side LONG or SHORT
 * @returns Keyset ID (LONG_<marketId> or SHORT_<marketId>)
 */
export function getKeysetForSide(market: Market, side: Side): string {
  const suffix = side === 'LONG' ? 'LONG' : 'SHORT'
  return `${suffix}_${market.slug}`
}
