import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('join page keeps auth and social profile errors in local, isolated state', () => {
  const source = read('src/routes/join/+page.svelte');

  assert.match(source, /let authError = \$state\(''\);/);
  assert.match(source, /let socialAuthError = \$state\(''\);/);
  assert.doesNotMatch(source, /let error = \$state\(''\);/);
  assert.match(source, /socialAuthError = socialError;/);
  assert.match(source, /authError = caught instanceof Error \? caught\.message : "Couldn't create an account on this device\.";/);
});

test('join social prefill waits for a clean initial state before consuming stored profile data', () => {
  const source = read('src/routes/join/+page.svelte');

  assert.match(source, /let loading = \$state\(true\);/);
  assert.match(
    source,
    /function canConsumeSocialProfilePrefill\(\): boolean \{[\s\S]*return !loading && !currentUser && !pending && !preparingRemoteSigner && !connectingBunker;[\s\S]*\}/
  );
  assert.match(
    source,
    /const prefill = canConsumeSocialProfilePrefill\(\) \? consumeSocialProfilePrefill\(\) : null;/
  );

  const prefillReads = source.match(/consumeSocialProfilePrefill\(\)/g) ?? [];
  assert.equal(prefillReads.length, 1);
});
