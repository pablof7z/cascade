import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchRecentMarkets } from '$lib/server/cascade';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  const edition = locals.cascadeEdition;
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  try {
    const markets = await fetchRecentMarkets(200, { edition });
    return {
      hideRightRail: true,
      markets: markets.map((market) => market.rawEvent as NostrEvent)
    };
  } catch (error) {
    console.warn('Builder market load failed', error);
    return {
      hideRightRail: true,
      markets: []
    };
  }
};
