/**
 * Quote Service — NUT-17 WebSocket for Real-time Quote Status
 *
 * Handles real-time quote status updates via WebSocket connection to the mint.
 * NUT-17 defines a standardized way to track quote lifecycle:
 * - QUOTE_CREATED: Quote created, invoice issued
 * - QUOTE_PENDING: Invoice sent, awaiting payment
 * - QUOTE_PAID: Invoice paid, processing
 * - QUOTE_COMPLETED: Quote fulfilled, tokens issued
 * - QUOTE_EXPIRED: Quote expired without payment
 * - QUOTE_CANCELLED: Quote cancelled
 *
 * This service maintains WebSocket connections to the mint for live updates
 * and provides a clean API for subscribing to quote status changes.
 */

import { discoverMintForMarket } from './mintDiscoveryService'
import type { Market } from '../market'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuoteStatus = 
  | 'idle' 
  | 'created' 
  | 'pending' 
  | 'paid' 
  | 'completed' 
  | 'processing'
  | 'expired' 
  | 'cancelled' 
  | 'failed'

export type QuoteSide = 'LONG' | 'SHORT'

/**
 * Unified Quote type for both WebSocket quote updates and trade quotes.
 * Used throughout the trading flow.
 */
export type Quote = {
  id: string
  type?: 'trade' | 'deposit'  // Optional type tag
  marketSlug: string
  mintUrl?: string            // For WebSocket subscriptions
  side: QuoteSide
  amount: number              // Amount in sats
  fee: number                 // Fee in sats
  status: QuoteStatus
  invoice?: string | null     // Lightning invoice (Bolt11)
  paymentHash?: string | null // For tracking payment
  createdAt: number           // Unix timestamp
  updatedAt?: number          // Last update timestamp
  expiresAt?: number | null   // Invoice expiration
  completedAt?: number | null // When fulfilled
  error?: string | null       // Error message if failed
  expectedAmount?: number     // Expected amount from mint response
}

export type QuoteCallbacks = {
  onStatusChange?: (quote: Quote, newStatus: QuoteStatus) => void
  onCompleted?: (quote: Quote) => void
  onExpired?: (quote: Quote) => void
  onError?: (quote: Quote, error: string) => void
}

export type QuoteSubscription = {
  unsubscribe: () => void
}

// ---------------------------------------------------------------------------
// Quote tracking (for trading integration)
// ---------------------------------------------------------------------------

const trackedQuotes = new Map<string, Quote>()

/**
 * Track a quote (called after trade execution to monitor quote lifecycle).
 *
 * @param quote The quote to track
 */
export function trackQuote(quote: Quote): void {
  trackedQuotes.set(quote.id, quote)
  quoteCache.set(quote.id, quote)
}

/**
 * Get a tracked quote by ID.
 *
 * @param quoteId Quote ID
 * @returns Quote or null
 */
export function getQuote(quoteId: string): Quote | null {
  return trackedQuotes.get(quoteId) || quoteCache.get(quoteId) || null
}

/**
 * Get all tracked quotes.
 *
 * @returns Array of tracked quotes
 */
export function getAllTrackedQuotes(): Quote[] {
  return Array.from(trackedQuotes.values())
}

/**
 * Clear a tracked quote.
 *
 * @param quoteId Quote ID to clear
 */
export function untrackQuote(quoteId: string): void {
  trackedQuotes.delete(quoteId)
}


type WebSocketConnection = {
  ws: WebSocket | null
  subscriptions: Set<string>  // Quote IDs subscribed
  reconnectAttempts: number
  callbacks: Map<string, QuoteCallbacks>
}

const activeConnections = new Map<string, WebSocketConnection>()
const quoteCache = new Map<string, Quote>()

// Reconnection settings
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 3000
const WEBSOCKET_PING_INTERVAL_MS = 30000

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to quote updates for a specific market.
 * Establishes a WebSocket connection to the mint and registers for updates.
 *
 * @param market The market to subscribe to
 * @param quoteId Optional quote ID to filter updates
 * @param callbacks Event callbacks
 * @returns QuoteSubscription with unsubscribe method
 */
export async function subscribeToQuoteUpdates(
  market: Market,
  callbacks: QuoteCallbacks,
): Promise<QuoteSubscription> {
  const mintInfo = await discoverMintForMarket(market)
  if (!mintInfo) {
    console.warn(`Cannot subscribe to quotes: mint unavailable for market ${market.slug}`)
    return { unsubscribe: () => {} }
  }

  const mintUrl = mintInfo.url

  // Get or create WebSocket connection for this mint
  let connection = activeConnections.get(mintUrl)
  if (!connection) {
    connection = {
      ws: null,
      subscriptions: new Set(),
      reconnectAttempts: 0,
      callbacks: new Map(),
    }
    activeConnections.set(mintUrl, connection)
  }

  // Generate a subscription ID
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  // Register callbacks
  connection.callbacks.set(subscriptionId, callbacks)

  // Add market to subscriptions
  connection.subscriptions.add(market.slug)

  // Connect or reconnect WebSocket
  await ensureWebSocketConnected(mintUrl)

  return {
    unsubscribe: () => {
      const conn = activeConnections.get(mintUrl)
      if (conn) {
        conn.callbacks.delete(subscriptionId)
        conn.subscriptions.delete(market.slug)

        // Close connection if no more subscriptions
        if (conn.subscriptions.size === 0 && conn.ws) {
          conn.ws.close()
          activeConnections.delete(mintUrl)
        }
      }
    },
  }
}

/**
 * Get current status of a quote.
 *
 * @param quoteId The quote ID to look up
 * @returns Quote or null if not found
 */
export function getQuoteStatus(quoteId: string): Quote | null {
  return quoteCache.get(quoteId) || null
}

/**
 * Get all quotes for a market.
 *
 * @param marketSlug Market slug
 * @returns Array of quotes for the market
 */
export function getQuotesForMarket(marketSlug: string): Quote[] {
  return Array.from(quoteCache.values()).filter(q => q.marketSlug === marketSlug)
}

/**
 * Clear expired quotes from cache.
 */
export function clearExpiredQuotes(): void {
  const now = Math.floor(Date.now() / 1000)
  for (const [id, quote] of quoteCache) {
    if (quote.status === 'expired' || quote.status === 'completed') {
      // Keep completed quotes for a while for reference
      if (quote.completedAt && now - quote.completedAt > 3600) {
        quoteCache.delete(id)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal WebSocket management
// ---------------------------------------------------------------------------

/**
 * Ensure WebSocket is connected to the mint.
 */
async function ensureWebSocketConnected(mintUrl: string): Promise<void> {
  const connection = activeConnections.get(mintUrl)
  if (!connection) return

  // Already connected?
  if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
    return
  }

  // Close existing if not open
  if (connection.ws) {
    connection.ws.close()
    connection.ws = null
  }

  // Build WebSocket URL
  const wsUrl = mintUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://')

  try {
    const ws = new WebSocket(`${wsUrl}/v1/ws/quotes`)

    ws.onopen = () => {
      console.log(`[quoteService] WebSocket connected to ${mintUrl}`)
      connection!.reconnectAttempts = 0

      // Send subscription message
      const subscribedMarkets = Array.from(connection!.subscriptions)
      ws.send(JSON.stringify({
        action: 'subscribe',
        markets: subscribedMarkets,
      }))
    }

    ws.onmessage = (event) => {
      handleWebSocketMessage(mintUrl, event.data)
    }

    ws.onerror = (error) => {
      console.error(`[quoteService] WebSocket error for ${mintUrl}:`, error)
    }

    ws.onclose = () => {
      console.log(`[quoteService] WebSocket closed for ${mintUrl}`)
      connection!.ws = null

      // Attempt reconnection
      if (connection!.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        connection!.reconnectAttempts++
        const delay = RECONNECT_DELAY_MS * connection!.reconnectAttempts
        console.log(`[quoteService] Reconnecting in ${delay}ms (attempt ${connection!.reconnectAttempts})`)
        setTimeout(() => ensureWebSocketConnected(mintUrl), delay)
      }
    }

    connection.ws = ws

    // Set up ping interval
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }))
      } else {
        clearInterval(pingInterval)
      }
    }, WEBSOCKET_PING_INTERVAL_MS)

  } catch (error) {
    console.error(`[quoteService] Failed to connect to ${mintUrl}:`, error)
  }
}

/**
 * Handle incoming WebSocket messages.
 */
function handleWebSocketMessage(mintUrl: string, data: string): void {
  try {
    const message = JSON.parse(data)

    // Handle different message types
    switch (message.type) {
      case 'quote_update':
        handleQuoteUpdate(mintUrl, message.quote)
        break

      case 'pong':
        // Heartbeat response
        break

      case 'error':
        console.warn(`[quoteService] Server error:`, message.error)
        break

      default:
        console.log(`[quoteService] Unknown message type:`, message.type)
    }
  } catch (error) {
    console.error(`[quoteService] Failed to parse message:`, error)
  }
}

/**
 * Handle a quote update from the WebSocket.
 */
function handleQuoteUpdate(mintUrl: string, quoteData: Record<string, unknown>): void {
  const quote: Quote = {
    id: quoteData.id as string,
    marketSlug: quoteData.market as string,
    side: quoteData.side as QuoteSide,
    amount: quoteData.amount as number,
    fee: quoteData.fee as number || 0,
    status: mapQuoteStatus(quoteData.status as string),
    invoice: quoteData.invoice as string | null,
    paymentHash: quoteData.payment_hash as string | null,
    createdAt: quoteData.created_at as number,
    expiresAt: quoteData.expires_at as number | null,
    completedAt: quoteData.completed_at as number | null,
    error: quoteData.error as string | null,
  }

  // Update cache
  const previousQuote = quoteCache.get(quote.id)
  quoteCache.set(quote.id, quote)

  // Notify callbacks
  const connection = activeConnections.get(mintUrl)
  if (connection) {
    for (const [, callbacks] of connection.callbacks) {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(quote, quote.status)
      }

      if (quote.status === 'completed' && callbacks.onCompleted) {
        callbacks.onCompleted(quote)
      }

      if (quote.status === 'expired' && callbacks.onExpired) {
        callbacks.onExpired(quote)
      }

      if (quote.status === 'failed' && callbacks.onError) {
        callbacks.onError(quote, quote.error || 'Quote failed')
      }
    }
  }

  // Log status change if there was a previous status
  if (previousQuote && previousQuote.status !== quote.status) {
    console.log(`[quoteService] Quote ${quote.id} status: ${previousQuote.status} -> ${quote.status}`)
  }
}

/**
 * Map server status string to QuoteStatus.
 */
function mapQuoteStatus(status: string): QuoteStatus {
  switch (status.toUpperCase()) {
    case 'CREATED':
      return 'created'
    case 'PENDING':
      return 'pending'
    case 'PAID':
      return 'paid'
    case 'COMPLETED':
      return 'completed'
    case 'EXPIRED':
      return 'expired'
    case 'CANCELLED':
      return 'cancelled'
    case 'FAILED':
      return 'failed'
    default:
      return 'idle'
  }
}

// ---------------------------------------------------------------------------
// HTTP Polling (fallback when WebSocket unavailable)
// ---------------------------------------------------------------------------

/**
 * Poll quote status via HTTP (fallback when WebSocket is unavailable).
 *
 * @param quoteId Quote ID to poll
 * @param callbacks Event callbacks
 * @returns Interval ID that can be cleared to stop polling
 */
export function pollQuoteStatus(
  quoteId: string,
  callbacks: QuoteCallbacks,
): () => void {
  const pollIntervalMs = 3000
  const maxPollAttempts = 100  // Stop after ~5 minutes

  let attempts = 0

  const interval = setInterval(async () => {
    attempts++

    if (attempts > maxPollAttempts) {
      clearInterval(interval)
      const quote = quoteCache.get(quoteId)
      if (quote && callbacks.onExpired) {
        callbacks.onExpired(quote)
      }
      return
    }

    try {
      const quote = await fetchQuoteStatus(quoteId)
      if (quote) {
        quoteCache.set(quoteId, quote)

        if (callbacks.onStatusChange) {
          callbacks.onStatusChange(quote, quote.status)
        }

        if (quote.status === 'completed' && callbacks.onCompleted) {
          callbacks.onCompleted(quote)
          clearInterval(interval)
        }

        if (quote.status === 'expired' && callbacks.onExpired) {
          callbacks.onExpired(quote)
          clearInterval(interval)
        }

        if (quote.status === 'failed' && callbacks.onError) {
          callbacks.onError(quote, quote.error || 'Quote failed')
          clearInterval(interval)
        }
      }
    } catch (error) {
      console.warn(`[quoteService] Error polling quote ${quoteId}:`, error)
    }
  }, pollIntervalMs)

  return () => clearInterval(interval)
}

/**
 * Fetch quote status via HTTP.
 */
async function fetchQuoteStatus(quoteId: string): Promise<Quote | null> {
  try {
    // Get mint URL from first active connection or use default
    const mintUrls = Array.from(activeConnections.keys())
    const mintUrl = mintUrls[0]
    if (!mintUrl) return null

    const response = await fetch(`${mintUrl}/v1/quote/${quoteId}`)
    if (!response.ok) {
      return null
    }

    const data = await response.json() as Record<string, unknown>
    return {
      id: data.id as string,
      marketSlug: data.market as string,
      side: data.side as QuoteSide,
      amount: data.amount as number,
      fee: data.fee as number || 0,
      status: mapQuoteStatus(data.status as string),
      invoice: data.invoice as string | null,
      paymentHash: data.payment_hash as string | null,
      createdAt: data.created_at as number,
      expiresAt: data.expires_at as number | null,
      completedAt: data.completed_at as number | null,
      error: data.error as string | null,
    }
  } catch {
    return null
  }
}
