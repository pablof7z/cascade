import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildMarketSeo } from '$lib/seo';
import { buildDiscussionThreads } from '$lib/ndk/cascade';
import { marketPageCacheControl } from '$lib/server/cascade-cache';
import { loadMarketSurface } from '$lib/server/cascade-pages';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  const data = await loadMarketSurface(params.slug);
  setHeaders({
    'cache-control': marketPageCacheControl(Boolean(data.market))
  });

  if (!data.market) {
    error(404, 'Market not found');
  }

  const threads = buildDiscussionThreads(data.discussions, data.market.id);
  const thread = threads.find((candidate) => candidate.post.id === params.threadId);

  if (!thread) {
    error(404, 'Thread not found');
  }

  return {
    ...data,
    thread,
    seo: buildMarketSeo({
      url,
      market: data.market,
      summary: thread.post.subject || thread.post.content
    })
  };
};
