import type { PageServerLoad } from './$types';
import { buildAboutSeo } from '$lib/seo';

export const load: PageServerLoad = ({ url }) => {
  return {
    seo: buildAboutSeo(url)
  };
};
