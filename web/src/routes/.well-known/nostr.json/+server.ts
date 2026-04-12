import type { RequestHandler } from '@sveltejs/kit';
import {
  isValidManagedNip05Name,
  normalizeManagedNip05Name
} from '$lib/ndk/nip05';
import { getManagedNip05Config } from '$lib/server/nip05/config';
import { getNip05Pubkey } from '$lib/server/nip05/store';

function respond(body: { names: Record<string, string> }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      'Content-Type': 'application/json'
    }
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const { enabled } = getManagedNip05Config();
  if (!enabled) return respond({ names: {} });

  const name = normalizeManagedNip05Name(url.searchParams.get('name'));
  if (!name || !isValidManagedNip05Name(name)) {
    return respond({ names: {} });
  }

  try {
    const pubkey = await getNip05Pubkey(name);

    return respond({
      names: pubkey ? { [name]: pubkey } : {}
    });
  } catch (error) {
    console.error('.well-known/nostr.json error:', error);
    return respond({ names: {} }, 500);
  }
};
