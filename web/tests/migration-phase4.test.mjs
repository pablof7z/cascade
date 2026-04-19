import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
function read(rel) { return readFileSync(resolve(webRoot, rel), 'utf8'); }

// Task 4.1: MarketCard
test('MarketCard uses daisyUI card and no custom styles', () => {
  const src = read('src/lib/components/cascade/MarketCard.svelte');
  assert.match(src, /class=["'][^"']*\bcard\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /rgba\(/);
});

// Task 4.2: MarketSurface
test('MarketSurface uses The Column market detail layout without custom CSS', () => {
  const src = read('src/lib/components/cascade/MarketSurface.svelte');
  assert.match(src, />Back a side</);
  assert.match(src, />The case</);
  assert.match(src, /font-serif/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /rgba\(/);
  assert.doesNotMatch(src, /var\(--accent/);
  assert.doesNotMatch(src, /var\(--radius-(md|sm)\b/);
  assert.doesNotMatch(src, /\bmarket-(header|copy|trading|bookmark-button)\b/);
});

// Task 4.3: PaperTradePanel
test('PaperTradePanel uses daisyUI form controls, no custom CSS', () => {
  const src = read('src/lib/components/cascade/PaperTradePanel.svelte');
  assert.match(src, /input\s+input-bordered/);
  assert.doesNotMatch(src, /\btrade-(panel|input-group|input-amount)\b/);
  assert.doesNotMatch(src, /<style\b/);
});

// Task 4.4: PortfolioPage
test('PortfolioPage uses Column patterns (no DaisyUI stats/table)', () => {
  const src = read('src/lib/components/cascade/PortfolioPage.svelte');
  assert.doesNotMatch(src, /\bstats\b/);
  assert.doesNotMatch(src, /\btable-zebra\b/);
  // Check for DaisyUI card component class usage, not word 'card' in phrases
  assert.doesNotMatch(src, /class=["']\s*[^"']*\bcard\b/);
  assert.doesNotMatch(src, /class=["'][^"']*\bcard-border\b/);
  assert.match(src, /\brounded-lg\b.*border.*bg-base-/);
});
