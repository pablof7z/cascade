import test from 'node:test';
import assert from 'node:assert/strict';

import type { NDKUserProfile } from '@nostr-dev-kit/ndk';

import { displayName, displayNip05, profileHref, profileIdentifier } from './format.ts';

const NPUB = 'npub1qx7uqr3v8c8tnemtq5p7d2sg32k7y3xyg6c3l4nedeg3kkacv4tsd5fk3g';

test('profileHref uses literal nip05 (with @) when declared', () => {
  const profile = { nip05: 'north@cascade.so' } as NDKUserProfile;
  assert.equal(profileHref(profile, NPUB), '/p/north@cascade.so');
});

test('profileHref strips _@ prefix from nip05 (NIP-05 root identifier)', () => {
  const profile = { nip05: '_@cascade.so' } as NDKUserProfile;
  assert.equal(profileHref(profile, NPUB), '/p/cascade.so');
});

test('profileHref falls back to npub when no nip05 declared', () => {
  assert.equal(profileHref(undefined, NPUB), `/p/${NPUB}`);
  assert.equal(profileHref({} as NDKUserProfile, NPUB), `/p/${NPUB}`);
});

test('profileHref falls back to npub when nip05 is empty/whitespace', () => {
  const profile = { nip05: '   ' } as NDKUserProfile;
  assert.equal(profileHref(profile, NPUB), `/p/${NPUB}`);
});

test('profileIdentifier returns nip05 verbatim, no encoding', () => {
  assert.equal(
    profileIdentifier({ nip05: 'north@cascade.so' } as NDKUserProfile, NPUB),
    'north@cascade.so'
  );
});

test('displayNip05 strips _@ root prefix', () => {
  assert.equal(displayNip05({ nip05: '_@cascade.so' } as NDKUserProfile), 'cascade.so');
  assert.equal(displayNip05({ nip05: 'north@cascade.so' } as NDKUserProfile), 'north@cascade.so');
});

test('displayName falls back through name → display_name → nip05 local-part → fallback', () => {
  assert.equal(displayName({ name: 'Nina' } as NDKUserProfile, 'fallback'), 'Nina');
  assert.equal(
    displayName({ displayName: 'Nina Ortega' } as NDKUserProfile, 'fallback'),
    'Nina Ortega'
  );
  assert.equal(
    displayName({ nip05: 'north@cascade.so' } as NDKUserProfile, 'fallback'),
    'north@cascade.so'
  );
  assert.equal(displayName(undefined, 'fallback'), 'fallback');
});
