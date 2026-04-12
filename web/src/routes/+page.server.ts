import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildHomeSeo } from '$lib/seo';
import {
  fetchProfilesForPubkeys,
  fetchRecentDiscussions,
  fetchRecentMarkets,
  fetchRecentTrades
} from '$lib/server/cascade';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  try {
    const [markets, discussions, trades] = await Promise.all([
      fetchRecentMarkets(60),
      fetchRecentDiscussions(80),
      fetchRecentTrades(240)
    ]);

    const profiles = await fetchProfilesForPubkeys([
      ...markets.map((market) => market.pubkey),
      ...discussions.map((discussion) => discussion.pubkey)
    ]);

    return {
      markets: markets.map((market) => market.rawEvent as NostrEvent),
      discussions: discussions.map((discussion) => discussion.rawEvent as NostrEvent),
      trades: trades.map((trade) => trade.rawEvent as NostrEvent),
      profiles,
      seo: buildHomeSeo(url)
    };
  } catch (error) {
    console.warn('Home page load failed', error);

    return {
      markets: [],
      discussions: [],
      trades: [],
      profiles: {},
      seo: buildHomeSeo(url)
    };
  }
};
