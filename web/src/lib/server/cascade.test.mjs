import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('fetchMarketsByAuthor uses Nostr instead of the removed creator API route', () => {
  const source = readFileSync(new URL('./cascade.ts', import.meta.url), 'utf8');
  const implementation = source.match(/export async function fetchMarketsByAuthor[\s\S]*?\n}\n/);

  assert.ok(implementation, 'fetchMarketsByAuthor should exist');
  assert.doesNotMatch(implementation[0], /\/api\/product\/markets\/creator\//);
  assert.match(implementation[0], /fetchEvents\(/);
});
