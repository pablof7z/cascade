import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildMarketSeo } from '$lib/seo';
import { marketPageCacheControl } from '$lib/server/cascade-cache';
import { loadMarketSurface } from '$lib/server/cascade-pages';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const data = await loadMarketSurface(params.slug, locals.cascadeEdition);
  setHeaders({
    'cache-control': marketPageCacheControl(Boolean(data.market), locals.cascadeEdition)
  });

  if (!data.market) {
    error(404, 'Market not found');
  }

  return {
    ...data,
    hideRightRail: true,
    seo: buildMarketSeo({ url, market: data.market, summary: `Trade history for ${data.market.title}` })
  };
};
