import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';
import { fetchRecentDiscussions, fetchRecentMarkets, fetchRecentTrades } from '$lib/server/cascade';

const ANALYTICS_MARKET_LIMIT = 20;
const ANALYTICS_DISCUSSION_LIMIT = 20;
const ANALYTICS_TRADE_LIMIT = 50;

function take<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
  const edition = locals.cascadeEdition;
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const [markets, discussions, trades] = await Promise.all([
    fetchRecentMarkets(ANALYTICS_MARKET_LIMIT, { edition }),
    fetchRecentDiscussions(ANALYTICS_DISCUSSION_LIMIT, { edition }),
    fetchRecentTrades(ANALYTICS_TRADE_LIMIT, { edition })
  ]);

  return {
    markets: take(markets, ANALYTICS_MARKET_LIMIT).map((market) => market.rawEvent as NostrEvent),
    discussions: take(discussions, ANALYTICS_DISCUSSION_LIMIT).map(
      (discussion) => discussion.rawEvent as NostrEvent
    ),
    trades: take(trades, ANALYTICS_TRADE_LIMIT).map((trade) => trade.rawEvent as NostrEvent),
    seo: buildPageSeo({
      url,
      title: 'Analytics',
      description: 'Market, trade, and discussion metrics for the visible Cascade network.'
    })
  };
};
