import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

const commitHash = execSync('git rev-parse --short=7 HEAD').toString().trim()
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), agentApiPlugin()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
})
