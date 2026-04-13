import test from 'node:test';
import assert from 'node:assert/strict';

import {
  proofWalletLegacyStorageKeys,
  proofWalletStorageKey
} from './proofStorage.ts';

test('proof wallet storage keys are namespaced by edition', () => {
  assert.equal(
    proofWalletStorageKey('signet', 'https://mint.f7z.io/', 'USD'),
    'cascade:signet:proof-wallet:https://mint.f7z.io:usd'
  );
  assert.equal(
    proofWalletStorageKey('mainnet', 'https://mint.f7z.io/', 'USD'),
    'cascade:mainnet:proof-wallet:https://mint.f7z.io:usd'
  );
  assert.notEqual(
    proofWalletStorageKey('signet', 'https://mint.f7z.io/', 'USD'),
    proofWalletStorageKey('mainnet', 'https://mint.f7z.io/', 'USD')
  );
});

test('proof wallet storage migration still checks legacy non-edition keys', () => {
  assert.deepEqual(proofWalletLegacyStorageKeys('https://mint.f7z.io/', 'LONG_Macro'), [
    'cascade:proof-wallet:https://mint.f7z.io:long_macro',
    'cascade:proof-wallet:https://mint.f7z.io:LONG_Macro'
  ]);
});
