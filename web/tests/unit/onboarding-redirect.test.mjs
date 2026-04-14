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

test('onboarding redirects new users to the homepage after publishing their profile', () => {
  const source = read('src/routes/onboarding/+page.svelte');

  assert.match(source, /await goto\('\/'\);/);
  assert.doesNotMatch(source, /await goto\(`\/p\/\$\{profileIdentifier\(nextProfile, publishingUser\.npub\)\}`\);/);
});
