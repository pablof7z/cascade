import { getLiquidityReport } from '../../src/agentDirectory'
import { readString, sendJson, type ApiRequest, type ApiResponse } from './_helpers'

export default function handler(req: ApiRequest, res: ApiResponse) {
  const marketId = readString(req.query.marketId)
  if (!marketId) {
    sendJson(res, 400, { error: 'marketId is required' })
    return
  }

  const data = getLiquidityReport(marketId)
  if (!data) {
    sendJson(res, 404, { error: 'liquidity report not found' })
    return
  }

  sendJson(res, 200, { data })
}
