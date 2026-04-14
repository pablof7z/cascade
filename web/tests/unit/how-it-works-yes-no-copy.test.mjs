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

test('how-it-works page uses YES/NO terminology in the market mechanics explainer', () => {
  const source = read('src/routes/how-it-works/+page.svelte');

  assert.match(source, /YES 41¢/);
  assert.match(source, /YES 58¢/);
  assert.match(source, /YES 49¢/);
  assert.match(source, /Strongly No/);
  assert.match(source, /Strongly Yes/);
  assert.match(source, /Taking a position means buying YES or NO\./);
  assert.match(source, /Anyone buys YES or NO\./);

  assert.doesNotMatch(source, /LONG 41¢/);
  assert.doesNotMatch(source, /LONG 58¢/);
  assert.doesNotMatch(source, /LONG 49¢/);
  assert.doesNotMatch(source, /Deep SHORT/);
  assert.doesNotMatch(source, /Deep LONG/);
  assert.doesNotMatch(source, /Taking a position means buying LONG or SHORT\./);
  assert.doesNotMatch(source, /Anyone goes LONG or SHORT\./);
});
