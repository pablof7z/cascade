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

test('embed market route uses scoped classes and theme variables instead of inline hardcoded styles', () => {
  const source = read('src/routes/embed/market/[slug]/+page.svelte');

  assert.doesNotMatch(
    source,
    /\sstyle=/,
    'embed market markup should not use inline style attributes'
  );

  assert.doesNotMatch(
    source,
    /#[0-9a-fA-F]{3,8}\b/,
    'embed market route should use theme variables instead of hardcoded hex colors'
  );

  assert.match(source, /class="embed-market-shell"/);
  assert.match(source, /class="embed-market-card"/);
  assert.match(source, /class="embed-market-metrics"/);
  assert.match(source, /class="embed-market-value"/);

  assert.match(source, /<style>[\s\S]*\.embed-market-shell/);
  assert.match(source, /var\(--color-base-100\)/);
  assert.match(source, /var\(--color-base-200\)/);
  assert.match(source, /var\(--color-base-300\)/);
  assert.match(source, /var\(--color-base-content\)/);
  assert.match(source, /var\(--color-neutral-content\)/);
  assert.match(source, /font-family:\s*var\(--font-mono\)/);
});
