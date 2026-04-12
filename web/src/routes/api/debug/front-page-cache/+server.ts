import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { inspectFrontPageCache } from '$lib/server/nostr';

export const GET: RequestHandler = async ({ url }) => {
  if (!dev) {
    throw error(404, 'Not found');
  }

  const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 12;
  const refresh = url.searchParams.get('refresh') === '1';

  return json(await inspectFrontPageCache({ limit, refresh }));
};
