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

test('primary site navigation links to bookmarks and how it works', () => {
  const source = read('src/lib/components/cascade/SiteNavigation.svelte');

  assert.match(source, /\{ href: '\/bookmarks', label: 'Bookmarks' \}/);
  assert.match(source, /\{ href: '\/how-it-works', label: 'How It Works' \}/);
  assert.match(source, /href=\{item\.href\}/);
});
