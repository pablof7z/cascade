import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildMarketSeo } from '$lib/seo';
import { fetchThreadRootDiscussion } from '$lib/server/cascade';
import { marketPageCacheControl } from '$lib/server/cascade-cache';
import { loadMarketSurface } from '$lib/server/cascade-pages';
import { resolveMarketThread } from '$lib/server/market-thread';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const edition = locals.cascadeEdition;
  const data = await loadMarketSurface(params.slug, edition);
  setHeaders({
    'cache-control': marketPageCacheControl(Boolean(data.market), edition)
  });

  if (!data.market) {
    error(404, 'Market not found');
  }

  const { discussions, thread } = await resolveMarketThread(data, params.threadId, () =>
    fetchThreadRootDiscussion(data.market.id, params.threadId, { edition })
  );

  if (!thread) {
    error(404, 'Thread not found');
  }

  return {
    ...data,
    discussions,
    thread,
    hideRightRail: true,
    seo: buildMarketSeo({
      url,
      market: data.market,
      summary: thread.post.subject || thread.post.content
    })
  };
};
