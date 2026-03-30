// First-party analytics — anonymous, no PII, no cookies, no third-party services
import type {
  AnalyticsEvent,
  AnalyticsEventType,
  HomepageEngagementDestination,
  HomepageEngagementSource,
} from './analyticsTypes'

const FLUSH_INTERVAL = 10_000 // 10 seconds
const HEARTBEAT_INTERVAL = 30_000 // 30 seconds

let sessionId: string | null = null
const queue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let sessionStart: number = 0

function getSessionId(): string {
  if (sessionId) return sessionId
  const stored = sessionStorage.getItem('_cascade_sid')
  if (stored) {
    sessionId = stored
    return stored
  }
  const id = crypto.randomUUID()
  sessionStorage.setItem('_cascade_sid', id)
  sessionId = id
  return id
}

function enqueue(event: AnalyticsEvent) {
  queue.push(event)
}

function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0)
  const payload = JSON.stringify(batch)
  // Prefer sendBeacon for reliability on unload; fall back to fetch
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', payload)
  } else {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // silently drop — analytics should never break the app
    })
  }
}

// ── Public API ──────────────────────────────────────────────

export function trackEvent(type: AnalyticsEventType, data: Record<string, unknown> = {}) {
  enqueue({
    type,
    sessionId: getSessionId(),
    timestamp: Date.now(),
    data,
  } as AnalyticsEvent)
}

export function trackPageView(path: string) {
  trackEvent('page_view', { path, referrer: document.referrer })
}

export function trackHomepageEngagement(
  source: HomepageEngagementSource,
  destination: HomepageEngagementDestination,
  marketId?: string,
) {
  trackEvent('homepage_engagement', marketId ? { source, destination, marketId } : { source, destination })
}

export function trackMarketView(marketId: string) {
  trackEvent('market_view', { marketId })
}

export function trackTradePlaced(marketId: string, outcome: string, amount: number) {
  trackEvent('trade_placed', { marketId, outcome, amount })
}

export function trackDiscussionInteraction(marketId: string, action: string) {
  trackEvent('discussion_interaction', { marketId, action })
}

export function trackWalletConnected() {
  trackEvent('wallet_connected')
}

// ── Lifecycle ───────────────────────────────────────────────

export function initAnalytics() {
  sessionStart = Date.now()
  trackEvent('session_start')

  // Periodic flush
  flushTimer = setInterval(flush, FLUSH_INTERVAL)

  // Heartbeat
  heartbeatTimer = setInterval(() => {
    trackEvent('session_heartbeat', { duration: Math.round((Date.now() - sessionStart) / 1000) })
  }, HEARTBEAT_INTERVAL)

  // Flush on page hide / unload
  const onLeave = () => {
    trackEvent('session_end', { duration: Math.round((Date.now() - sessionStart) / 1000) })
    flush()
  }
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave()
  })
  window.addEventListener('pagehide', onLeave)
}

export function destroyAnalytics() {
  if (flushTimer) clearInterval(flushTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  flush()
}
