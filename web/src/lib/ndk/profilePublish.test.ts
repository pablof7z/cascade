import test from 'node:test';
import assert from 'node:assert/strict';

import { serializeProfile, type NDKUserProfile } from '@nostr-dev-kit/ndk';

import { sanitizeProfileForPublish } from './profilePublish.ts';

test('sanitizeProfileForPublish strips NDK metadata from kind 0 payloads', () => {
  const serialized = serializeProfile(
    sanitizeProfileForPublish({
      name: 'PABLOF7z',
      displayName: 'PABLOF7z',
      about: 'Magical Other Stuff Maximalist',
      website: 'https://pablof7z.com',
      picture: 'https://m.primal.net/KwlG.jpg',
      banner: 'https://24242.io/banner.png',
      lud16: 'pablof7z@primal.net',
      nip05: '_@f7z.io',
      created_at: 1_775_548_726,
      profileEvent: '{"kind":0}',
      id: 'event-id',
      pubkey: 'f'.repeat(64),
      sig: 's'.repeat(128),
      kind: 0,
      content: '{"name":"stale"}'
    } as NDKUserProfile)
  );

  assert.deepEqual(JSON.parse(serialized), {
    name: 'PABLOF7z',
    display_name: 'PABLOF7z',
    about: 'Magical Other Stuff Maximalist',
    website: 'https://pablof7z.com',
    picture: 'https://m.primal.net/KwlG.jpg',
    banner: 'https://24242.io/banner.png',
    lud16: 'pablof7z@primal.net',
    nip05: '_@f7z.io'
  });
});

test('sanitizeProfileForPublish preserves custom profile fields', () => {
  const serialized = serializeProfile(
    sanitizeProfileForPublish({
      name: 'PABLOF7z',
      pronouns: 'he/him',
      favorite_number: 7,
      created_at: 1_775_548_726,
      profileEvent: '{"kind":0}'
    } as NDKUserProfile)
  );

  assert.deepEqual(JSON.parse(serialized), {
    name: 'PABLOF7z',
    pronouns: 'he/him',
    favorite_number: 7
  });
});
