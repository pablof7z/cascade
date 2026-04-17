import { getAllPosts } from '$lib/blog/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const posts = getAllPosts();
  return {
    posts,
    seo: {
      title: 'Blog — Cascade',
      description:
        'Thinking on prediction markets, belief pricing, and the ideas behind Cascade.'
    }
  };
};
