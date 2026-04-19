import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
function read(rel) { return readFileSync(resolve(webRoot, rel), 'utf8'); }

test('homepage uses daisyUI classes and no Cascade-custom layouts', () => {
  const src = read('src/routes/+page.svelte');
  assert.match(src, /\btextarea\b/);
  assert.match(src, /\bselect\b/);
  assert.match(src, /\bbtn\b/);
  assert.doesNotMatch(src, /\bhero-(grid|h1)\b/);
  assert.doesNotMatch(src, /\btrending-(layout|lead)\b/);
  assert.doesNotMatch(src, /\brank-(head|row)\b/);
  assert.doesNotMatch(src, /\bhome-split\b/);
  assert.doesNotMatch(src, /\bfeatured-market\b/);
  assert.doesNotMatch(src, /\bhow-steps\b/);
  assert.doesNotMatch(src, /rgba\(\d/);
});

test('about page uses daisyUI classes and no custom about-* styles', () => {
  const src = read('src/routes/about/+page.svelte');
  assert.doesNotMatch(src, /\babout-(page|hero|section|principles|cta|actions)\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /var\(--accent/);
  assert.doesNotMatch(src, /color-mix/);
});

test('how-it-works page uses daisyUI classes and no custom how-* styles', () => {
  const src = read('src/routes/how-it-works/+page.svelte');
  assert.doesNotMatch(src, /\bhow-(page|hero|section|split|stack|curve|network|discussion|final)\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /color-mix/);
  assert.doesNotMatch(src, /var\(--font-mono\)/);
});

test('terms page uses prose wrapper and time element', () => {
  const src = read('src/routes/terms/+page.svelte');
  assert.match(src, /prose/);
  assert.match(src, /<time\b/);
  assert.doesNotMatch(src, /\bsurface\b|\bpanel\b|\bcontent-prose\b/);
  assert.doesNotMatch(src, /<style\b/);
});

test('privacy page uses prose wrapper and time element', () => {
  const src = read('src/routes/privacy/+page.svelte');
  assert.match(src, /prose/);
  assert.match(src, /<time\b/);
  assert.doesNotMatch(src, /\bsurface\b|\bpanel\b|\bcontent-prose\b/);
  assert.doesNotMatch(src, /<style\b/);
});

test('error page uses Column CSS instead of DaisyUI hero', () => {
  const src = read('src/routes/+error.svelte');
  assert.doesNotMatch(src, /\bhero\b/);
  assert.doesNotMatch(src, /hero-content/);
  assert.match(src, /\bsite-frame\b/);
  assert.match(src, /\btext-3xl\b.*\bfont-bold\b/);
  assert.doesNotMatch(src, /<style\b/);
});
