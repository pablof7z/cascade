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

test('primary site navigation uses The Column rail items', () => {
  const source = read('src/lib/components/cascade/SiteNavigation.svelte');

  assert.match(source, /\{ href: '\/', label: 'Home', icon: 'home' \}/);
  assert.match(source, /\{ href: '\/markets', label: 'Markets', icon: 'markets' \}/);
  assert.match(source, /\{ href: '\/bookmarks', label: 'Bookmarks', icon: 'bookmark' \}/);
  assert.match(source, /\{ href: '\/portfolio', label: 'Portfolio', icon: 'portfolio' \}/);
  assert.match(source, /\{ href: '\/profile', label: 'Profile', icon: 'profile' \}/);
  assert.match(source, /href=\{item\.href\}/);
  assert.match(source, /class="rail-nav"/);
  assert.doesNotMatch(source, /menu-horizontal/);
});
