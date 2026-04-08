/**
 * Withdraw Service — Lightning Withdrawal from Cashu Wallet
 *
 * Handles the flow of withdrawing sats from the Cascade wallet:
 * 1. Detect input type (bolt11, Lightning address, LNURL)
 * 2. Resolve Lightning addresses to bolt11 invoices via LNURL-pay
 * 3. Estimate melt fees before executing
 * 4. Melt Cashu tokens against a bolt11 invoice with structured error handling
 */

import { getMintUrl } from '../lib/config/mint'
import { withdrawToLightning } from './settlementService'
import { getWalletBalance } from '../walletStore'

// ---------------------------------------------------------------------------
// Structured error types
// ---------------------------------------------------------------------------

export type MeltErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'INVOICE_EXPIRED'
  | 'MINT_ERROR'
  | 'NETWORK_ERROR'
  | 'FEE_EXCEEDED'
  | 'INVALID_INPUT'

export interface MeltResult {
  success: boolean
  preimage?: string
  feePaid?: number
  error?: {
    code: MeltErrorCode
    message: string
  }
}

// ---------------------------------------------------------------------------
// Input type detection
// ---------------------------------------------------------------------------

/**
 * Detect the type of a Lightning payment input string.
 *
 * @param input Raw user input (bolt11 invoice, Lightning address, or LNURL)
 * @returns Input type classification
 */
export function detectInputType(
  input: string
): 'bolt11' | 'lightning_address' | 'lnurl' | 'invalid' {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  // Lightning address check must come first — addresses like lntb@domain.com or
  // lnbc123@example.com would otherwise match the bolt11 prefix checks below.
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'lightning_address'
  }

  // bolt11: starts with lnbc (mainnet) or lntbs/lntb/lnbcrt (testnet)
  if (
    lower.startsWith('lnbc') ||
    lower.startsWith('lntbs') ||
    lower.startsWith('lntb') ||
    lower.startsWith('lnbcrt')
  ) {
    return 'bolt11'
  }

  // lnurl: bech32-encoded LNURL, starts with lnurl1
  if (lower.startsWith('lnurl1')) {
    return 'lnurl'
  }

  return 'invalid'
}

// ---------------------------------------------------------------------------
// Amount extraction from bolt11
// ---------------------------------------------------------------------------

/**
 * Extract the amount in satoshis from a bolt11 invoice's human-readable part.
 * Returns null if the invoice encodes no amount (amount-less invoice).
 *
 * @param invoice bolt11 payment request string
 * @returns Amount in satoshis, or null if not present
 */
export function extractAmountFromBolt11(invoice: string): number | null {
  // HRP format: ln{network}{amount}{multiplier}1{bech32data}
  // Multiplier suffixes: m=milli, u=micro, n=nano, p=pico (relative to 1 BTC)
  // Put tbs before tb so the longer prefix matches first
  const match = invoice
    .trim()
    .toLowerCase()
    .match(/^ln(?:bc|tbs|tb|bcrt)(\d+)([munp])?1[ac-hj-np-z02-9]/)

  if (!match) return null

  const num = parseInt(match[1], 10)
  const multiplierChar = match[2]

  const multipliers: Record<string, number> = {
    m: 0.001,
    u: 0.000001,
    n: 0.000000001,
    p: 0.000000000001,
  }

  const multiplier = multiplierChar ? multipliers[multiplierChar] : 1
  if (multiplier === undefined) return null

  // pico-BTC (p): 1 sat = 10,000 pico-BTC. If the amount can't represent a whole
  // number of sats, the invoice is malformed per the BOLT11 spec — return null.
  if (multiplierChar === 'p' && num % 10000 !== 0) {
    return null
  }

  const sats = Math.floor(num * multiplier * 1e8)
  return sats > 0 ? sats : null
}

// ---------------------------------------------------------------------------
// Lightning address resolution (LNURL-pay)
// ---------------------------------------------------------------------------

/**
 * Resolve a Lightning address to a bolt11 invoice via LNURL-pay.
 *
 * @param address Lightning address in user@domain.tld format
 * @param amountMsats Amount to pay in millisatoshis
 * @returns bolt11 invoice string ready to pay
 * @throws Error if the domain is unreachable, amount is out of range, or the response is invalid
 */
export async function resolveLightningAddress(
  address: string,
  amountMsats: number
): Promise<string> {
  const parts = address.trim().split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid Lightning address format: ${address}`)
  }
  const [user, domain] = parts

  // Step 1: Fetch LNURL-pay metadata from well-known endpoint
  let lnurlpData: {
    callback: string
    minSendable: number
    maxSendable: number
    status?: string
    tag?: string
    reason?: string
  }

  try {
    const metaResponse = await fetch(
      `https://${domain}/.well-known/lnurlp/${user}`
    )
    if (!metaResponse.ok) {
      throw new Error(
        `Domain unreachable or address not found: ${metaResponse.status} ${metaResponse.statusText}`
      )
    }
    lnurlpData = await metaResponse.json()
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error(`Failed to reach ${domain}`)
  }

  // Check for LNURL error response
  if (lnurlpData.status === 'ERROR') {
    throw new Error(`LNURL error: ${lnurlpData.reason || 'unknown error'}`)
  }

  if (!lnurlpData.callback) {
    throw new Error('Invalid LNURL response: missing callback URL')
  }

  if (lnurlpData.tag !== 'payRequest') {
    throw new Error(
      `Invalid LNURL response: expected tag "payRequest", got "${lnurlpData.tag}"`
    )
  }

  // Step 2: Validate amount against the sendable range
  const { minSendable, maxSendable, callback } = lnurlpData

  if (amountMsats < minSendable) {
    throw new Error(
      `Amount ${amountMsats} msats is below the minimum ${minSendable} msats`
    )
  }
  if (amountMsats > maxSendable) {
    throw new Error(
      `Amount ${amountMsats} msats exceeds the maximum ${maxSendable} msats`
    )
  }

  // Step 3: Request the invoice from the callback URL
  const callbackUrl = new URL(callback)
  callbackUrl.searchParams.set('amount', String(amountMsats))
  callbackUrl.searchParams.set('comment', '')

  let invoiceData: { pr?: string; reason?: string }

  try {
    const invoiceResponse = await fetch(callbackUrl.toString())
    if (!invoiceResponse.ok) {
      throw new Error(
        `Callback request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`
      )
    }
    invoiceData = await invoiceResponse.json()
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Failed to fetch invoice from LNURL callback')
  }

  if (!invoiceData.pr) {
    const reason = invoiceData.reason || 'no invoice returned'
    throw new Error(`Invalid LNURL response: ${reason}`)
  }

  // LUD-06 requires verifying the returned invoice encodes the requested amount.
  // A malicious or buggy endpoint could return an invoice for a different amount.
  const expectedSats = amountMsats / 1000
  const invoiceSats = extractAmountFromBolt11(invoiceData.pr)
  if (invoiceSats === null || invoiceSats !== expectedSats) {
    throw new Error(
      `LNURL returned invoice with amount ${invoiceSats ?? 'unknown'} sats, expected ${expectedSats} sats`
    )
  }

  return invoiceData.pr
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

const FEE_RATE = 0.005 // 0.5%
const MIN_FEE_SATS = 1

/**
 * Estimate the Lightning melt fee for a given withdrawal amount.
 *
 * Uses a flat 0.5% rate with a 1-sat minimum.
 *
 * @param amountSats Amount to withdraw in satoshis
 * @returns Estimated fee and total (amount + fee) in satoshis
 */
export async function estimateMeltFee(
  amountSats: number
): Promise<{ fee: number; total: number }> {
  const fee = Math.max(MIN_FEE_SATS, Math.round(amountSats * FEE_RATE))
  return { fee, total: amountSats + fee }
}

// ---------------------------------------------------------------------------
// Melt tokens (withdraw to Lightning)
// ---------------------------------------------------------------------------

/**
 * Melt Cashu tokens to pay a Lightning invoice (NUT-05 melt).
 *
 * Wraps withdrawToLightning with balance checking and structured error categorization.
 *
 * @param amountSats Amount to withdraw in satoshis
 * @param invoice bolt11 payment request
 * @param options.skipBalanceCheck Skip pre-flight balance validation
 * @returns MeltResult with success status, preimage, and structured error if applicable
 */
export async function meltTokens(
  amountSats: number,
  invoice: string,
  options: { skipBalanceCheck?: boolean } = {}
): Promise<MeltResult> {
  const mintUrl = getMintUrl()

  // Estimate fee before proceeding
  const { fee: estimatedFee, total } = await estimateMeltFee(amountSats)

  // Pre-flight balance check
  if (!options.skipBalanceCheck) {
    try {
      const balance = await getWalletBalance()
      if (total > balance) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient balance: need ${total} sats (${amountSats} + ${estimatedFee} fee), have ${balance} sats`,
          },
        }
      }
    } catch {
      // Unable to read balance — proceed and let the mint reject if needed
    }
  }

  // Execute the melt
  let result: { success: boolean; preimage?: string; message?: string }
  try {
    result = await withdrawToLightning(amountSats, invoice, mintUrl)
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Network error during withdrawal',
      },
    }
  }

  if (result.success) {
    return {
      success: true,
      preimage: result.preimage,
    }
  }

  // Categorize the error from the message
  const msg = (result.message || '').toLowerCase()

  let code: MeltErrorCode

  if (msg.includes('expired')) {
    code = 'INVOICE_EXPIRED'
  } else if (msg.includes('fee') && (msg.includes('exceeded') || msg.includes('too high'))) {
    code = 'FEE_EXCEEDED'
  } else if (
    msg.includes('invalid') ||
    msg.includes('bad request') ||
    msg.includes('malformed')
  ) {
    code = 'INVALID_INPUT'
  } else if (
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('fetch')
  ) {
    code = 'NETWORK_ERROR'
  } else {
    code = 'MINT_ERROR'
  }

  return {
    success: false,
    error: {
      code,
      message: result.message || 'Withdrawal failed',
    },
  }
}
