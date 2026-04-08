import { error } from '@sveltejs/kit';
import { fetchMarketBySlugAndPubkey } from '$lib/../services/nostrService';
import { parseMarketEvent } from '$lib/../services/marketService';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const marketId = params.marketId;
  
  // Fetch the market event from Nostr (client-side — NDK is initialized by +layout.ts)
  // fetchMarketBySlugAndPubkey without pubkey prefix returns the first match
  const event = await fetchMarketBySlugAndPubkey(marketId);

  if (!event) {
    throw error(404, 'Market not found');
  }
  
  // Parse the event into a Market object
  const result = parseMarketEvent(event);
  
  if (!result.ok || !result.market) {
    throw error(404, 'Market not found');
  }
  
  return { market: result.market };
};