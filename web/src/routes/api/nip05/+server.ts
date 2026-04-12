import { json, type RequestHandler } from '@sveltejs/kit';
import type { NostrEvent } from '@nostr-dev-kit/ndk';
import {
  formatManagedNip05Identifier,
  isValidManagedNip05Name,
  normalizeManagedNip05Name
} from '$lib/ndk/nip05';
import { getManagedNip05Config } from '$lib/server/nip05/config';
import { verifyNip05RegistrationAuth } from '$lib/server/nip05/auth';
import {
  clearNip05ForPubkey,
  getNip05Pubkey,
  hasPersistentNip05Store,
  setNip05
} from '$lib/server/nip05/store';

function featureDisabledResponse() {
  return json({ error: 'Managed NIP-05 registration is not enabled.' }, { status: 404 });
}

function parseAuthBody(body: unknown): NostrEvent | null {
  if (!body || typeof body !== 'object') return null;

  const auth = (body as Record<string, unknown>).auth;
  if (!auth || typeof auth !== 'object') return null;

  return auth as NostrEvent;
}

export const GET: RequestHandler = async ({ url }) => {
  const { domain, enabled } = getManagedNip05Config();
  if (!enabled || !domain) return featureDisabledResponse();

  const name = normalizeManagedNip05Name(url.searchParams.get('name'));
  if (!name || !isValidManagedNip05Name(name)) {
    return json(
      { error: 'name must be 1-64 lowercase alphanumeric characters, hyphens, or underscores.' },
      { status: 400 }
    );
  }

  try {
    const pubkey = await getNip05Pubkey(name);

    return json({
      available: !pubkey,
      exists: Boolean(pubkey),
      identifier: formatManagedNip05Identifier(name, domain),
      persistent: hasPersistentNip05Store(),
      pubkey
    });
  } catch (error) {
    console.error('NIP-05 lookup error:', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const { domain, enabled } = getManagedNip05Config();
  if (!enabled || !domain) return featureDisabledResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = normalizeManagedNip05Name((body as Record<string, unknown>).name as string | undefined);
  if (!name || !isValidManagedNip05Name(name)) {
    return json(
      { error: 'name must be 1-64 lowercase alphanumeric characters, hyphens, or underscores.' },
      { status: 400 }
    );
  }

  const auth = parseAuthBody(body);
  if (!auth) {
    return json({ error: 'A signed NIP-05 authorization event is required.' }, { status: 400 });
  }

  let pubkey: string;
  try {
    ({ pubkey } = verifyNip05RegistrationAuth({ auth, action: 'register', domain, name }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid NIP-05 authorization.';
    return json({ error: message }, { status: 401 });
  }

  try {
    const existingPubkey = await getNip05Pubkey(name);
    if (existingPubkey && existingPubkey !== pubkey) {
      return json({ error: 'Username is already taken.' }, { status: 409 });
    }

    await setNip05(name, pubkey);

    return json(
      {
        identifier: formatManagedNip05Identifier(name, domain),
        ok: true,
        pubkey
      },
      { status: existingPubkey === pubkey ? 200 : 201 }
    );
  } catch (error) {
    console.error('NIP-05 registration error:', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { domain, enabled } = getManagedNip05Config();
  if (!enabled || !domain) return featureDisabledResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const auth = parseAuthBody(body);
  if (!auth) {
    return json({ error: 'A signed NIP-05 authorization event is required.' }, { status: 400 });
  }

  let pubkey: string;
  try {
    ({ pubkey } = verifyNip05RegistrationAuth({ auth, action: 'clear', domain }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid NIP-05 authorization.';
    return json({ error: message }, { status: 401 });
  }

  try {
    await clearNip05ForPubkey(pubkey);
    return json({ ok: true });
  } catch (error) {
    console.error('NIP-05 removal error:', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
};
