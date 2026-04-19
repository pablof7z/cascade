import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
function read(rel) { return readFileSync(resolve(webRoot, rel), 'utf8'); }

test('Task 3.1: SiteNavigation uses The Column rail, no top-nav menu-horizontal, no CSS vars', () => {
  const siteNavigation = read('src/lib/components/cascade/SiteNavigation.svelte');
  assert.match(siteNavigation, /class="rail-nav"/);
  assert.match(siteNavigation, /class="rail-item"/);
  assert.doesNotMatch(siteNavigation, /menu\s+menu-horizontal/);
  assert.doesNotMatch(siteNavigation, /var\(--/);
  assert.doesNotMatch(siteNavigation, /border-neutral-\d+/);
});

test('Task 3.2: Footer uses daisyUI footer class and no custom styles', () => {
  const footer = read('src/lib/components/cascade/Footer.svelte');
  assert.match(footer, /class=["'][^"']*\bfooter\b/);
  assert.doesNotMatch(footer, /<style\b/);
  assert.doesNotMatch(footer, /var\(--(?!color-|font-|radius-)/);
});

test('Task 3.5: dashboard layout uses daisyUI menu and no custom dash-* styles', () => {
  const src = read('src/routes/dashboard/+layout.svelte');
  assert.match(src, /class=["'][^"']*\bmenu\b/);
  assert.doesNotMatch(src, /\bdash-/);
  assert.doesNotMatch(src, /<style\b/);
});
