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
      hideRightRail: true,
      seo: buildPageSeo({
        url,
        title: 'Subscriptions',
        description: 'Claims from writers you follow on Cascade.'
      })
    };
  } catch (error) {
    console.warn('Subscriptions page load failed', error);

    return {
      markets: [],
      trades: [],
      profiles: {},
      hideRightRail: true,
      seo: buildPageSeo({
        url,
        title: 'Subscriptions',
        description: 'Claims from writers you follow on Cascade.'
      })
    };
  }
};
