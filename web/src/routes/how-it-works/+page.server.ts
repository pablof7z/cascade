import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';

export const load: PageServerLoad = ({ url }) => {
  return {
    seo: buildPageSeo({
      url,
      title: 'How It Works',
      description:
        'Cascade prediction markets never close. Take a position on any thesis, argue your case publicly, and exit whenever the price moves your way. No expiry, no oracle.'
    })
  };
};
