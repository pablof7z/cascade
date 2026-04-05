import { fetchMarketBySlug } from '../../../services/nostrService'
import { parseMarketEvent } from '../../../services/marketService'
import type { Market } from '../../../market'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
  const marketId = params.marketId

  // Fetch the market event from Nostr
  const event = await fetchMarketBySlug(marketId)

  if (!event) {
    return { market: null }
  }

  // Parse the event into a Market object
  const result = parseMarketEvent(event)

  if (!result.ok || !result.market) {
    return { market: null }
  }

  return { market: result.market }
}