import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
import {
  NIP05_REGISTRATION_AUTH_KIND,
  NIP05_REGISTRATION_AUTH_WINDOW_SECONDS
} from '$lib/ndk/nip05';

type Nip05RegistrationAction = 'register' | 'clear';

function readFirstTagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

export function verifyNip05RegistrationAuth(args: {
  auth: NostrEvent;
  action: Nip05RegistrationAction;
  domain: string;
  name?: string;
}): { pubkey: string } {
  const event = new NDKEvent(undefined, args.auth);

  if (event.kind !== NIP05_REGISTRATION_AUTH_KIND) {
    throw new Error('Invalid NIP-05 authorization event kind.');
  }

  if (!event.verifySignature(false)) {
    throw new Error('Invalid NIP-05 authorization signature.');
  }

  const createdAt = event.created_at;
  const now = Math.floor(Date.now() / 1000);
  if (typeof createdAt !== 'number' || Math.abs(now - createdAt) > NIP05_REGISTRATION_AUTH_WINDOW_SECONDS) {
    throw new Error('Expired NIP-05 authorization event.');
  }

  const authAction = readFirstTagValue(event.tags, 'action');
  if (authAction !== args.action) {
    throw new Error('Invalid NIP-05 authorization action.');
  }

  const authDomain = readFirstTagValue(event.tags, 'domain');
  if (authDomain !== args.domain) {
    throw new Error('Invalid NIP-05 authorization domain.');
  }

  const authScope = readFirstTagValue(event.tags, 't');
  if (authScope !== 'nip05-registration') {
    throw new Error('Invalid NIP-05 authorization scope.');
  }

  if (args.action === 'register') {
    const authName = readFirstTagValue(event.tags, 'name');
    if (!args.name || authName !== args.name) {
      throw new Error('Invalid NIP-05 authorization name.');
    }
  }

  if (!/^[0-9a-f]{64}$/.test(event.pubkey)) {
    throw new Error('Invalid NIP-05 authorization pubkey.');
  }

  return { pubkey: event.pubkey };
}
