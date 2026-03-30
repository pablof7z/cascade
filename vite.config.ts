import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs'

// Use Vercel's env var, fallback to git command, fallback to 'dev'
const commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || (existsSync('.git') ? execSync('git rev-parse --short=7 HEAD').toString().trim() : 'dev')
import {
  getAgentMarket,
  getLiquidityReport,
  listAgentMarkets,
  listOwnedMarkets,
  searchAgentMarkets,
  type AgentMarketKind,
  type LiquidityState,
} from './src/agentDirectory'

function sendJson(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(data))
}

function readNumber(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function agentApiPlugin() {
  return {
    name: 'cascade-agent-api-mock',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/agent')) {
          next()
          return
        }

        const url = new URL(req.url, 'http://127.0.0.1')
        const { pathname, searchParams } = url

        if (pathname === '/api/agent/markets') {
          const data = listAgentMarkets({
            kind: searchParams.get('kind') as AgentMarketKind | undefined,
            ownerId: searchParams.get('ownerId') ?? undefined,
            tag: searchParams.get('tag') ?? undefined,
            liquidityState: searchParams.get('liquidityState') as LiquidityState | undefined,
            minReserve: readNumber(searchParams.get('minReserve')),
            limit: readNumber(searchParams.get('limit')),
          })
          sendJson(res, 200, { data, meta: { count: data.length } })
          return
        }

        if (pathname.startsWith('/api/agent/markets/')) {
          const marketId = pathname.split('/').at(-1)
          const data = marketId ? getAgentMarket(marketId) : null
          if (!data) {
            sendJson(res, 404, { error: 'market not found' })
            return
          }
          sendJson(res, 200, { data })
          return
        }

        if (pathname === '/api/agent/liquidity') {
          const marketId = searchParams.get('marketId')
          const data = marketId ? getLiquidityReport(marketId) : null
          if (!data) {
            sendJson(res, 404, { error: 'liquidity report not found' })
            return
          }
          sendJson(res, 200, { data })
          return
        }

        if (pathname === '/api/agent/owned-markets') {
          const ownerId = searchParams.get('ownerId') ?? 'human-primary'
          const data = listOwnedMarkets(ownerId)
          sendJson(res, 200, { data, meta: { ownerId, count: data.length } })
          return
        }

        if (pathname === '/api/agent/search') {
          const q = searchParams.get('q') ?? ''
          const data = searchAgentMarkets(q, {
            kind: searchParams.get('kind') as AgentMarketKind | undefined,
            ownerId: searchParams.get('ownerId') ?? undefined,
            tag: searchParams.get('tag') ?? undefined,
            liquidityState: searchParams.get('liquidityState') as LiquidityState | undefined,
            minReserve: readNumber(searchParams.get('minReserve')),
            limit: readNumber(searchParams.get('limit')),
          })
          sendJson(res, 200, { data, meta: { q, count: data.length } })
          return
        }

        sendJson(res, 404, { error: 'unknown agent endpoint' })
      })
    },
  }
}

function analyticsApiPlugin() {
  const DATA_DIR = 'data'
  const JSONL_PATH = `${DATA_DIR}/analytics.jsonl`

  return {
    name: 'cascade-analytics-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/analytics')) {
          next()
          return
        }

        const url = new URL(req.url, 'http://127.0.0.1')

        // POST /api/analytics — ingest events
        if (url.pathname === '/api/analytics' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const events = JSON.parse(body)
              if (!Array.isArray(events)) throw new Error('expected array')
              mkdirSync(DATA_DIR, { recursive: true })
              const lines = events.map((e: unknown) => JSON.stringify(e)).join('\n') + '\n'
              appendFileSync(JSONL_PATH, lines)
              res.statusCode = 204
              res.end()
            } catch {
              sendJson(res, 400, { error: 'invalid payload' })
            }
          })
          return
        }

        // GET /api/analytics/summary — compute summary from JSONL
        if (url.pathname === '/api/analytics/summary' && req.method === 'GET') {
          if (!existsSync(JSONL_PATH)) {
            sendJson(res, 200, {
              dailyActiveSessions: 0,
              weeklyActiveSessions: 0,
              topMarkets: [],
              funnel: { pageViews: 0, marketViews: 0, tradesPlaced: 0 },
              averageSessionDuration: 0,
              generatedAt: Date.now(),
            })
            return
          }

          const raw = readFileSync(JSONL_PATH, 'utf-8')
          const events = raw
            .split('\n')
            .filter(Boolean)
            .map((line) => { try { return JSON.parse(line) } catch { return null } })
            .filter(Boolean)

          const now = Date.now()
          const DAY = 86_400_000
          const dailySessions = new Set<string>()
          const weeklySessions = new Set<string>()
          const marketViews: Record<string, number> = {}
          let pageViews = 0
          let marketViewCount = 0
          let tradesPlaced = 0
          const sessionDurations: number[] = []

          for (const e of events) {
            if (now - e.timestamp < DAY) dailySessions.add(e.sessionId)
            if (now - e.timestamp < 7 * DAY) weeklySessions.add(e.sessionId)

            switch (e.type) {
              case 'page_view':
                pageViews++
                break
              case 'market_view':
                marketViewCount++
                if (e.data?.marketId) {
                  marketViews[e.data.marketId] = (marketViews[e.data.marketId] || 0) + 1
                }
                break
              case 'trade_placed':
                tradesPlaced++
                break
              case 'session_end':
              case 'session_heartbeat':
                if (e.data?.duration) sessionDurations.push(e.data.duration)
                break
            }
          }

          const topMarkets = Object.entries(marketViews)
            .map(([marketId, views]) => ({ marketId, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)

          const averageSessionDuration = sessionDurations.length
            ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
            : 0

          sendJson(res, 200, {
            dailyActiveSessions: dailySessions.size,
            weeklyActiveSessions: weeklySessions.size,
            topMarkets,
            funnel: { pageViews, marketViews: marketViewCount, tradesPlaced },
            averageSessionDuration,
            generatedAt: now,
          })
          return
        }

        sendJson(res, 404, { error: 'unknown analytics endpoint' })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), agentApiPlugin(), analyticsApiPlugin()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
})
