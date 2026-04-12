import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';
import {
  fetchProfilesForPubkeys,
  fetchRecentDiscussions,
  fetchRecentMarkets
} from '$lib/server/cascade';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const [markets, discussions] = await Promise.all([
    fetchRecentMarkets(120),
    fetchRecentDiscussions(240)
  ]);

  const profiles = await fetchProfilesForPubkeys([
    ...markets.map((market) => market.pubkey),
    ...discussions.map((discussion) => discussion.pubkey)
  ]);

  return {
    markets: markets.map((market) => market.rawEvent as NostrEvent),
    discussions: discussions.map((discussion) => discussion.rawEvent as NostrEvent),
    profiles,
    seo: buildPageSeo({
      url,
      title: 'Leaderboard',
      description: 'Creator and discussion leaderboards derived from public Cascade events.'
    })
  };
};
