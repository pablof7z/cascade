import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';
import {
  fetchProfilesForPubkeys,
  fetchRecentDiscussions,
  fetchRecentMarkets,
  fetchRecentTrades
} from '$lib/server/cascade';

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
  const edition = locals.cascadeEdition;
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const [markets, discussions, trades] = await Promise.all([
    fetchRecentMarkets(60, { edition }),
    fetchRecentDiscussions(100, { edition }),
    fetchRecentTrades(240, { edition })
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
    seo: buildPageSeo({
      url,
      title: 'Activity',
      description: 'Recent market creations, trade records, and discussion updates across Cascade.'
    })
  };
};
