import { error } from '@sveltejs/kit';
import { fetchMarketBySlugAndPubkey } from '../../../services/nostrService';
import { parseMarketEvent } from '../../../services/marketService';
import { parseMarketSlug } from '../../../lib/marketSlug';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const { slug, pubkeyPrefix } = parseMarketSlug(params.slugAndPrefix);
  const event = await fetchMarketBySlugAndPubkey(slug, pubkeyPrefix);

  if (!event) {
    throw error(404, 'Market not found');
  }

  const result = parseMarketEvent(event);
  if (!result.ok || !result.market) {
    throw error(404, 'Market not found');
  }

  return { market: result.market };
};