import { fetchMarketBySlug } from '../../../services/nostrService'
import { parseMarketEvent } from '../../../services/marketService'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const marketId = params.marketId

  // Fetch the market event from Nostr
  const event = await fetchMarketBySlug(marketId)

  if (!event) {
    return { market: null, seo: null }
  }

  // Parse the event into a Market object
  const result = parseMarketEvent(event)

  if (!result.ok || !result.market) {
    return { market: null, seo: null }
  }

  const market = result.market

  setHeaders({ 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' })

  return {
    market,
    seo: {
      title: market.title,
      description: market.description,
      image: market.image ?? null
    }
  }
}
