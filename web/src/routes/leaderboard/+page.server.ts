import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';
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

  const [markets, discussions, trades] = await Promise.all([
    fetchRecentMarkets(120),
    fetchRecentDiscussions(240),
    fetchRecentTrades(240)
  ]);

  const profiles = await fetchProfilesForPubkeys([
    ...markets.map((market) => market.pubkey),
    ...discussions.map((discussion) => discussion.pubkey),
    ...trades.map((trade) => trade.pubkey)
  ]);

  return {
    markets: markets.map((market) => market.rawEvent as NostrEvent),
    discussions: discussions.map((discussion) => discussion.rawEvent as NostrEvent),
    trades: trades.map((trade) => trade.rawEvent as NostrEvent),
    profiles,
    seo: buildPageSeo({
      url,
      title: 'Leaderboard',
      description: 'Top market creators, active traders, and the most-bookmarked questions on Cascade.'
    })
  };
};
