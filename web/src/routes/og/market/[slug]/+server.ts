import type { RequestHandler } from './$types';
import { fetchMarketBySlug } from '$lib/server/cascade';
import { renderMarketOgImage } from '$lib/server/og';

const CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  try {
    const market = await fetchMarketBySlug(params.slug, { edition: locals.cascadeEdition });
    if (!market) throw new Error('Market not found');
    const image = await renderMarketOgImage({ market });
    return new Response(new Uint8Array(image), {
      headers: {
        'cache-control': CACHE_CONTROL,
        'content-type': 'image/png'
      }
    });
  } catch (error) {
    console.warn('Failed to render market OG image', error);
    return Response.redirect(new URL('/og-default.png', url), 307);
  }
};
