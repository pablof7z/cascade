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

test('builder page shows YES/NO labels while keeping long/short option values', () => {
  const source = read('src/routes/builder/+page.svelte');

  assert.match(source, /<option value="long">Supports YES<\/option>/);
  assert.match(source, /<option value="short">Supports NO<\/option>/);
  assert.match(source, /<option value="long">YES<\/option>/);
  assert.match(source, /<option value="short">NO<\/option>/);
  assert.doesNotMatch(source, /<option value="long">Supports LONG<\/option>/);
  assert.doesNotMatch(source, /<option value="short">Supports SHORT<\/option>/);
  assert.doesNotMatch(source, /<option value="long">LONG<\/option>/);
  assert.doesNotMatch(source, /<option value="short">SHORT<\/option>/);
});
