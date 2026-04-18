import { dev } from '$app/environment';
import { redirect, type Handle } from '@sveltejs/kit';
import {
  CASCADE_EDITION_COOKIE,
  getCascadeEdition,
  parseCascadeEdition
} from '$lib/cascade/config';

export const handle: Handle = async ({ event, resolve }) => {
  const requestedEdition = parseCascadeEdition(event.url.searchParams.get('edition'));

  if (requestedEdition) {
    event.cookies.set(CASCADE_EDITION_COOKIE, requestedEdition, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 24 * 365
    });

    const nextUrl = new URL(event.url);
    nextUrl.searchParams.delete('edition');
    const query = nextUrl.searchParams.toString();
    redirect(303, `${nextUrl.pathname}${query ? `?${query}` : ''}${nextUrl.hash}`);
  }

  event.locals.cascadeEdition = getCascadeEdition(
    event.cookies.get(CASCADE_EDITION_COOKIE) ?? null
  );

  const response = await resolve(event);

  // Pages are edition-sensitive: the cascade_edition cookie controls which
  // markets/trades are shown. Without Vary: Cookie, browsers serve a cached
  // mainnet page even after the user switches to Practice (or vice versa).
  const existingVary = response.headers.get('vary');
  if (!existingVary?.includes('Cookie')) {
    response.headers.set('vary', existingVary ? `${existingVary}, Cookie` : 'Cookie');
  }

  return response;
};
