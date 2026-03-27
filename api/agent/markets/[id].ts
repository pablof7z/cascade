import { getAgentMarket } from '../../../src/agentDirectory'
import { readString, sendJson, type ApiRequest, type ApiResponse } from '../_helpers'

export default function handler(req: ApiRequest, res: ApiResponse) {
  const marketId = readString(req.query.id)
  if (!marketId) {
    sendJson(res, 400, { error: 'market id is required' })
    return
  }

  const data = getAgentMarket(marketId)
  if (!data) {
    sendJson(res, 404, { error: 'market not found' })
    return
  }

  sendJson(res, 200, { data })
}
