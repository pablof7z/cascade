import type { VercelRequest, VercelResponse } from '@vercel/node'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const VALID_TYPES = new Set([
  'page_view',
  'homepage_engagement',
  'market_view',
  'trade_placed',
  'discussion_interaction',
  'wallet_connected',
  'session_start',
  'session_heartbeat',
  'session_end',
])

interface IncomingEvent {
  type: string
  sessionId: string
  timestamp: number
  data: Record<string, unknown>
}

function isValidEvent(e: unknown): e is IncomingEvent {
  if (typeof e !== 'object' || e === null) return false
  const ev = e as Record<string, unknown>
  return (
    typeof ev.type === 'string' &&
    VALID_TYPES.has(ev.type) &&
    typeof ev.sessionId === 'string' &&
    ev.sessionId.length > 0 &&
    typeof ev.timestamp === 'number' &&
    typeof ev.data === 'object' &&
    ev.data !== null
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let events: unknown[]
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!Array.isArray(body)) return res.status(400).json({ error: 'Body must be an array' })
    events = body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const valid = events.filter(isValidEvent)
  if (valid.length === 0) return res.status(400).json({ error: 'No valid events' })

  const storePath = process.env.ANALYTICS_STORE_PATH || '.analytics/events.jsonl'
  const dir = path.dirname(storePath)

  try {
    await fs.mkdir(dir, { recursive: true })
    const lines = valid.map((e) => JSON.stringify(e)).join('\n') + '\n'
    await fs.appendFile(storePath, lines, 'utf-8')
  } catch (err) {
    // Gracefully degrade when filesystem is unavailable (e.g., Vercel serverless)
    console.error('Analytics write error (non-critical):', err)
    return res.status(204).end()
  }

  return res.status(204).end()
}
