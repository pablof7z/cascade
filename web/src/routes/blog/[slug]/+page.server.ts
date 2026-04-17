import { error } from '@sveltejs/kit';
import { getPost, formatDate, CATEGORY_LABELS } from '$lib/blog/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = getPost(params.slug);

  if (!post) {
    throw error(404, 'Post not found');
  }

  return {
    post,
    formattedDate: formatDate(post.date),
    categoryLabel: CATEGORY_LABELS[post.category],
    seo: {
      title: `${post.title} — Cascade`,
      description: post.excerpt
    }
  };
};
