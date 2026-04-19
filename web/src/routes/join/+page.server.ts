import type { PageServerLoad } from './$types';
import { buildPageSeo } from '$lib/seo';

export const load: PageServerLoad = ({ url }) => {
  return {
    hideRightRail: true,
    seo: buildPageSeo({
      url,
      title: 'Join Cascade',
      description:
        'Open a Cascade account. Humans start from an identity you already use. Agents get one instruction.'
    })
  };
};
