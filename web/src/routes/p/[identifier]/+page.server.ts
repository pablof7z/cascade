import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildProfileSeo } from '$lib/seo';
import {
  fetchDiscussionsByPubkey,
  fetchMarketsByAuthor,
  fetchMarketsByIds,
  fetchPositionsByPubkey,
  fetchProfileContext
} from '$lib/server/cascade';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const { user, profile, lookupIdentifier } = await fetchProfileContext(params.identifier);
  if (!user?.pubkey) {
    error(404, 'Profile not found');
  }

  const discussionsPromise = fetchDiscussionsByPubkey(user.pubkey, 50);
  const [markets, positions, discussions] = await Promise.all([
    fetchMarketsByAuthor(user.pubkey, 48),
    fetchPositionsByPubkey(user.pubkey, 120),
    discussionsPromise
  ]);
  const discussionMarkets = await fetchMarketsByIds(discussions.map((discussion) => discussion.marketId));
  const positionMarkets = await fetchMarketsByIds(positions.map((p) => p.marketId));

  return {
    identifier: params.identifier,
    lookupIdentifier,
    pubkey: user.pubkey,
    npub: user.npub,
    profile,
    markets,
    positions,
    discussions,
    discussionMarkets,
    positionMarkets,
    seo: buildProfileSeo({ url, pubkey: user.pubkey, profile })
  };
};
