import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildMarketSeo } from '$lib/seo';
import { loadMarketSurface } from '$lib/server/cascade-pages';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  const data = await loadMarketSurface(params.slug);
  if (!data.market) {
    error(404, 'Market not found');
  }

  return {
    ...data,
    seo: buildMarketSeo({ url, market: data.market })
  };
};
