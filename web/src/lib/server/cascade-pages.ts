import {
  fetchMarketBySlug,
  fetchMarketDiscussions,
  fetchMarketTrades,
  fetchProfilesForPubkeys,
  fetchRecentMarkets
} from '$lib/server/cascade';
import { getCascadeEdition, type CascadeEdition } from '$lib/cascade/config';

export async function loadMarketSurface(
  slug: string,
  edition: CascadeEdition | string | null = getCascadeEdition()
) {
  const selectedEdition = getCascadeEdition(edition);
  const market = await fetchMarketBySlug(slug, { edition: selectedEdition });
  if (!market) {
    return {
      market: null,
      trades: [],
      discussions: [],
      relatedMarkets: [],
      profiles: {}
    };
  }

  const [trades, discussions, recentMarkets] = await Promise.all([
    fetchMarketTrades(market, 240, { edition: selectedEdition }),
    fetchMarketDiscussions(market.id, 240, { edition: selectedEdition }),
    fetchRecentMarkets(48, { edition: selectedEdition })
  ]);

  const relatedMarkets = recentMarkets
    .filter((candidate) => candidate.id !== market.id)
    .filter((candidate) => {
      if (market.categories.length === 0 && market.topics.length === 0) return true;
      return (
        candidate.categories.some((category) => market.categories.includes(category)) ||
        candidate.topics.some((topic) => market.topics.includes(topic))
      );
    })
    .slice(0, 6);

  const profiles = await fetchProfilesForPubkeys([
    market.pubkey,
    ...trades.map((trade) => trade.pubkey),
    ...discussions.map((discussion) => discussion.pubkey),
    ...relatedMarkets.map((candidate) => candidate.pubkey)
  ]);

  return {
    market,
    trades,
    discussions,
    relatedMarkets,
    profiles
  };
}
