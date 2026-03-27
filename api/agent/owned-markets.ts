import { listOwnedMarkets } from '../../src/agentDirectory'
import { readString, sendJson, type ApiRequest, type ApiResponse } from './_helpers'

export default function handler(req: ApiRequest, res: ApiResponse) {
  const ownerId = readString(req.query.ownerId) ?? 'human-primary'
  const data = listOwnedMarkets(ownerId)
  sendJson(res, 200, { data, meta: { ownerId, count: data.length } })
}
