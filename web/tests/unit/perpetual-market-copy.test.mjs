import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

async function loadCascadeHelpers() {
  return import(pathToFileURL(path.join(webRoot, 'src/lib/ndk/cascade.ts')).href);
}

test('sanitizeMarketCopy rewrites legacy resolution criteria into trading context language', async () => {
  const { sanitizeMarketCopy } = await loadCascadeHelpers();

  assert.match(
    sanitizeMarketCopy('Resolution Criteria: Price reflects consensus through trading activity.'),
    /^trading context: Price reflects consensus through trading activity\.$/i
  );
});

test('homepage and market surface keep perpetual-market copy without resolution language', () => {
  const homeSource = read('src/routes/+page.svelte');
  const marketSurfaceSource = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(
    homeSource,
    /Take a position today\. Trading continues indefinitely, and you can exit whenever the price makes sense for you\./
  );
  assert.doesNotMatch(homeSource, /settled — or forever/);
  assert.match(marketSurfaceSource, /const tradingContext = \$derived\(/);
  assert.match(marketSurfaceSource, /<h3>Trading context<\/h3>/);
  assert.doesNotMatch(marketSurfaceSource, /resolution criteria/i);
});
