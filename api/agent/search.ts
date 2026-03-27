import { searchAgentMarkets, type AgentMarketKind, type LiquidityState } from '../../src/agentDirectory'
import { readNumber, readString, sendJson, type ApiRequest, type ApiResponse } from './_helpers'

export default function handler(req: ApiRequest, res: ApiResponse) {
  const q = readString(req.query.q) ?? ''
  const kind = readString(req.query.kind) as AgentMarketKind | undefined
  const ownerId = readString(req.query.ownerId)
  const tag = readString(req.query.tag)
  const liquidityState = readString(req.query.liquidityState) as LiquidityState | undefined
  const minReserve = readNumber(req.query.minReserve)
  const limit = readNumber(req.query.limit)

  const data = searchAgentMarkets(q, {
    kind,
    ownerId,
    tag,
    liquidityState,
    minReserve,
    limit,
  })

  sendJson(res, 200, { data, meta: { q, count: data.length } })
}
