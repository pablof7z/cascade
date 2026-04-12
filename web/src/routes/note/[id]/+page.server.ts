import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchArticleComments, fetchArticleHighlights, fetchNoteWithAuthor } from '$lib/server/nostr';
import { profileIdentifier } from '$lib/ndk/format';
import { buildMissingSeo, buildNoteSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const { event, author, profile } = await fetchNoteWithAuthor(params.id);

    if (!event || !author) {
      return {
        missing: true,
        seo: buildMissingSeo(url, 'Note not found')
      };
    }

    const [comments, highlights] =
      event.kind === 30023
        ? await Promise.all([fetchArticleComments(event), fetchArticleHighlights(event)])
        : [[], []];

    return {
      missing: false,
      event: event.rawEvent() as NostrEvent,
      comments: comments.map((comment) => comment.rawEvent() as NostrEvent),
      highlights: highlights.map((highlight) => highlight.rawEvent() as NostrEvent),
      authorPubkey: author.pubkey,
      authorIdentifier: profileIdentifier(profile, author.npub),
      authorNpub: author.npub,
      profile,
      seo: buildNoteSeo({
        url,
        identifier: params.id,
        event: event.rawEvent() as NostrEvent,
        authorPubkey: author.pubkey,
        profile
      })
    };
  } catch (error) {
    console.warn('Note SSR load failed', error);

    return {
      missing: true,
      seo: buildMissingSeo(url, 'Note unavailable')
    };
  }
};
