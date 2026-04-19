import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchProfilesForPubkeys, fetchRecentMarkets, fetchRecentTrades } from '$lib/server/cascade';
import { buildPageSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
  const edition = locals.cascadeEdition;
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  try {
    const [markets, trades] = await Promise.all([
      fetchRecentMarkets(120, { edition }),
      fetchRecentTrades(480, { edition })
    ]);
    const profiles = await fetchProfilesForPubkeys(markets.map((market) => market.pubkey));

    return {
      markets: markets.map((market) => market.rawEvent as NostrEvent),
      trades: trades.map((trade) => trade.rawEvent as NostrEvent),
      profiles,
      seo: buildPageSeo({
        url,
        title: 'Markets',
        description: 'Browse live Cascade claims by category, activity, price, and public trading volume.'
      })
    };
  } catch (error) {
    console.warn('Markets page load failed', error);

    return {
      markets: [],
      trades: [],
      profiles: {},
      seo: buildPageSeo({
        url,
        title: 'Markets',
        description: 'Browse live Cascade claims by category, activity, price, and public trading volume.'
      })
    };
  }
};
