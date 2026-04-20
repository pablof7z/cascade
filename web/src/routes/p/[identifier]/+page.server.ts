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
import { fetchRecentNotesByAuthor } from '$lib/server/nostr';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const edition = locals.cascadeEdition;
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const { user, profile, lookupIdentifier } = await fetchProfileContext(params.identifier);
  if (!user?.pubkey) {
    error(404, 'Profile not found');
  }

  const [markets, positions, discussions, noteEvents] = await Promise.all([
    fetchMarketsByAuthor(user.pubkey, 48, { edition }),
    fetchPositionsByPubkey(user.pubkey, 120),
    fetchDiscussionsByPubkey(user.pubkey, 50, { edition }),
    fetchRecentNotesByAuthor(user.pubkey, 24)
  ]);

  const discussionMarkets = await fetchMarketsByIds(
    discussions.map((discussion) => discussion.marketId),
    { edition }
  );
  const positionMarkets = await fetchMarketsByIds(
    positions.map((position) => position.marketId),
    { edition }
  );

  const notes = noteEvents.map((event) => ({
    id: event.id,
    content: event.content,
    createdAt: event.created_at ?? 0
  }));

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
    notes,
    hideRightRail: true,
    seo: buildProfileSeo({ url, pubkey: user.pubkey, profile })
  };
};
