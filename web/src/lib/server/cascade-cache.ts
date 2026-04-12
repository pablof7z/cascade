import { isPaperEdition } from '$lib/cascade/config';

const MARKET_PAGE_CACHE_CONTROL = 'public, max-age=30, s-maxage=120, stale-while-revalidate=600';

export function marketPageCacheControl(hasMarket: boolean): string {
  if (isPaperEdition()) {
    return 'no-store';
  }

  if (!hasMarket) {
    return 'no-store';
  }

  return MARKET_PAGE_CACHE_CONTROL;
}
