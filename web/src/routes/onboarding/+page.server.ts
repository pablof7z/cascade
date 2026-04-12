import type { PageServerLoad } from './$types';
import { buildOnboardingSeo } from '$lib/seo';
import { getManagedNip05Config } from '$lib/server/nip05/config';
import { hasPersistentNip05Store } from '$lib/server/nip05/store';

export const load: PageServerLoad = ({ url }) => {
  const { domain } = getManagedNip05Config();

  return {
    nip05Domain: domain,
    nip05Persistent: hasPersistentNip05Store(),
    seo: buildOnboardingSeo(url)
  };
};
