import { fetchMarketBySlug } from '../../../services/nostrService'
import { parseMarketEvent } from '../../../services/marketService'
import type { Market } from '../../../market'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
  const marketId = params.marketId
  const event = await fetchMarketBySlug(marketId)
  if (!event) return { market: null }
  const result = parseMarketEvent(event)
  if (!result.ok || !result.market) return { market: null }
  return { market: result.market }
}
