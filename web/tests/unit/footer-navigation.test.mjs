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

test('footer reference links do not point to the empty blog route', () => {
  const source = read('src/lib/components/cascade/Footer.svelte');

  assert.match(source, /href="\/how-it-works">How It Works<\/a>/);
  assert.match(source, /href="\/terms">Terms<\/a>/);
  assert.match(source, /href="\/privacy">Privacy<\/a>/);
  assert.doesNotMatch(source, /href="\/blog">Blog<\/a>/);
});
