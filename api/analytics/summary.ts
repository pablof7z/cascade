import type { VercelRequest, VercelResponse } from '@vercel/node'
import { promises as fs } from 'node:fs'
import type {
  HomepageEngagementDestination,
  HomepageEngagementSource,
} from '../../src/analyticsTypes.js'

interface StoredEvent {
  type: string
  sessionId: string
  timestamp: number
  data: Record<string, unknown>
}

type SessionFlags = {
  landingAt: number | null
  homepageEngagedAt: number | null
  marketViewedAt: number | null
  discussionOpenedAt: number | null
  tradePlacedAt: number | null
}

type HomepageSourceAggregate = {
  source: HomepageEngagementSource
  destination: HomepageEngagementDestination
  events: number
  sessions: Set<string>
}

const FUNNEL_WINDOW_DAYS = 7

function recordFirstTouch(value: number | null, timestamp: number) {
  return value === null ? timestamp : Math.min(value, timestamp)
}

function emptySummary(now: number) {
  return {
    dailyActiveSessions: 0,
    weeklyActiveSessions: 0,
    topMarkets: [],
    funnel: {
      windowDays: FUNNEL_WINDOW_DAYS,
      landingViews: 0,
      homepageEngaged: 0,
      marketViews: 0,
      discussionOpens: 0,
      tradesPlaced: 0,
    },
    homepageSources: [],
    averageSessionDuration: 0,
    generatedAt: now,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const storePath = process.env.ANALYTICS_STORE_PATH || '.analytics/events.jsonl'

  let lines: string[]
  try {
    const raw = await fs.readFile(storePath, 'utf-8')
    lines = raw.split('\n').filter((l) => l.trim().length > 0)
  } catch {
    return res.status(200).json(emptySummary(Date.now()))
  }

  const events: StoredEvent[] = []
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as StoredEvent)
    } catch {
      // skip malformed lines
    }
  }

  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const weekAgo = now - FUNNEL_WINDOW_DAYS * 24 * 60 * 60 * 1000

  // Daily / weekly active sessions
  const dailySessions = new Set<string>()
  const weeklySessions = new Set<string>()
  for (const e of events) {
    if (e.timestamp >= dayAgo) dailySessions.add(e.sessionId)
    if (e.timestamp >= weekAgo) weeklySessions.add(e.sessionId)
  }

  const recentEvents = events.filter((event) => event.timestamp >= weekAgo)
  const sessionFlags = new Map<string, SessionFlags>()

  const ensureFlags = (sessionId: string) => {
    const existing = sessionFlags.get(sessionId)
    if (existing) return existing

    const next: SessionFlags = {
      landingAt: null,
      homepageEngagedAt: null,
      marketViewedAt: null,
      discussionOpenedAt: null,
      tradePlacedAt: null,
    }
    sessionFlags.set(sessionId, next)
    return next
  }

  // Top 10 most viewed markets in the active funnel window
  const marketViews = new Map<string, number>()
  const homepageSources = new Map<string, HomepageSourceAggregate>()
  for (const e of recentEvents) {
    const flags = ensureFlags(e.sessionId)

    if (e.type === 'page_view' && e.data && e.data.path === '/') {
      flags.landingAt = recordFirstTouch(flags.landingAt, e.timestamp)
    }

    if (e.type === 'homepage_engagement') {
      const source = typeof e.data.source === 'string' ? e.data.source : null
      const destination = typeof e.data.destination === 'string' ? e.data.destination : null

      if (source && destination) {
        flags.homepageEngagedAt = recordFirstTouch(flags.homepageEngagedAt, e.timestamp)

        const key = `${source}:${destination}`
        const aggregate = homepageSources.get(key) ?? {
          source: source as HomepageEngagementSource,
          destination: destination as HomepageEngagementDestination,
          events: 0,
          sessions: new Set<string>(),
        }

        aggregate.events += 1
        aggregate.sessions.add(e.sessionId)
        homepageSources.set(key, aggregate)
      }
    }

    if (e.type === 'market_view' && e.data && typeof e.data.marketId === 'string') {
      flags.marketViewedAt = recordFirstTouch(flags.marketViewedAt, e.timestamp)
      const id = e.data.marketId
      marketViews.set(id, (marketViews.get(id) || 0) + 1)
    }

    if (
      e.type === 'discussion_interaction' &&
      e.data &&
      typeof e.data.action === 'string' &&
      (e.data.action === 'open_discussion' || e.data.action === 'view_thread')
    ) {
      flags.discussionOpenedAt = recordFirstTouch(flags.discussionOpenedAt, e.timestamp)
    }

    if (e.type === 'trade_placed') {
      flags.tradePlacedAt = recordFirstTouch(flags.tradePlacedAt, e.timestamp)
    }
  }
  const topMarkets = [...marketViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marketId, views]) => ({ marketId, views }))

  let landingViews = 0
  let homepageEngaged = 0
  let marketViewCount = 0
  let discussionOpens = 0
  let tradesPlaced = 0

  for (const flags of sessionFlags.values()) {
    const hasLanding = flags.landingAt !== null
    const hasHomepageEngagement =
      hasLanding &&
      flags.homepageEngagedAt !== null &&
      flags.homepageEngagedAt >= (flags.landingAt as number)
    const hasMarketView =
      hasHomepageEngagement &&
      flags.marketViewedAt !== null &&
      flags.marketViewedAt >= (flags.homepageEngagedAt as number)
    const hasDiscussionOpen =
      hasMarketView &&
      flags.discussionOpenedAt !== null &&
      flags.discussionOpenedAt >= (flags.marketViewedAt as number)
    const hasTrade =
      hasDiscussionOpen &&
      flags.tradePlacedAt !== null &&
      flags.tradePlacedAt >= (flags.discussionOpenedAt as number)

    if (hasLanding) {
      landingViews += 1
    }
    if (hasHomepageEngagement) {
      homepageEngaged += 1
    }
    if (hasMarketView) {
      marketViewCount += 1
    }
    if (hasDiscussionOpen) {
      discussionOpens += 1
    }
    if (hasTrade) {
      tradesPlaced += 1
    }
  }

  // Average session duration from session_end events
  const durations: number[] = []
  for (const e of events) {
    if (
      (e.type === 'session_end' || e.type === 'session_heartbeat') &&
      e.data &&
      typeof e.data.duration === 'number'
    ) {
      durations.push(e.data.duration)
    }
  }
  const averageSessionDuration =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

  return res.status(200).json({
    dailyActiveSessions: dailySessions.size,
    weeklyActiveSessions: weeklySessions.size,
    topMarkets,
    funnel: {
      windowDays: FUNNEL_WINDOW_DAYS,
      landingViews,
      homepageEngaged,
      marketViews: marketViewCount,
      discussionOpens,
      tradesPlaced,
    },
    homepageSources: [...homepageSources.values()]
      .sort((left, right) => right.sessions.size - left.sessions.size || right.events - left.events)
      .map((aggregate) => ({
        source: aggregate.source,
        destination: aggregate.destination,
        sessions: aggregate.sessions.size,
        events: aggregate.events,
      })),
    averageSessionDuration: Math.round(averageSessionDuration),
    generatedAt: now,
  })
}
