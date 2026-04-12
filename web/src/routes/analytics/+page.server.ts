import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';
import { fetchRecentDiscussions, fetchRecentMarkets, fetchRecentTrades } from '$lib/server/cascade';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const [markets, discussions, trades] = await Promise.all([
    fetchRecentMarkets(100),
    fetchRecentDiscussions(160),
    fetchRecentTrades(400)
  ]);

  return {
    markets: markets.map((market) => market.rawEvent as NostrEvent),
    discussions: discussions.map((discussion) => discussion.rawEvent as NostrEvent),
    trades: trades.map((trade) => trade.rawEvent as NostrEvent),
    seo: buildPageSeo({
      url,
      title: 'Analytics',
      description: 'Market, trade, and discussion metrics for the visible Cascade network.'
    })
  };
};
