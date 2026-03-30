import type { VercelRequest, VercelResponse } from '@vercel/node'
import { promises as fs } from 'node:fs'

interface StoredEvent {
  type: string
  sessionId: string
  timestamp: number
  data: Record<string, unknown>
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
    // No data yet — return empty summary
    return res.status(200).json({
      dailyActiveSessions: 0,
      weeklyActiveSessions: 0,
      topMarkets: [],
      funnel: { pageViews: 0, marketViews: 0, tradesPlaced: 0 },
      averageSessionDuration: 0,
      generatedAt: Date.now(),
    })
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
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  // Daily / weekly active sessions
  const dailySessions = new Set<string>()
  const weeklySessions = new Set<string>()
  for (const e of events) {
    if (e.timestamp >= dayAgo) dailySessions.add(e.sessionId)
    if (e.timestamp >= weekAgo) weeklySessions.add(e.sessionId)
  }

  // Top 10 most viewed markets
  const marketViews = new Map<string, number>()
  for (const e of events) {
    if (e.type === 'market_view' && e.data && typeof e.data.marketId === 'string') {
      const id = e.data.marketId
      marketViews.set(id, (marketViews.get(id) || 0) + 1)
    }
  }
  const topMarkets = [...marketViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marketId, views]) => ({ marketId, views }))

  // Funnel
  let pageViews = 0
  let marketViewCount = 0
  let tradesPlaced = 0
  for (const e of events) {
    if (e.type === 'page_view') pageViews++
    else if (e.type === 'market_view') marketViewCount++
    else if (e.type === 'trade_placed') tradesPlaced++
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
    funnel: { pageViews, marketViews: marketViewCount, tradesPlaced },
    averageSessionDuration: Math.round(averageSessionDuration),
    generatedAt: now,
  })
}
