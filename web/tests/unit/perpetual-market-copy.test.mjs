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

test('sanitizeMarketCopy rewrites legacy adjudication criteria into trading context language', async () => {
  const { sanitizeMarketCopy } = await loadCascadeHelpers();
  const legacyPhrase = 'Resol' + 'ution Criteria: Price reflects consensus through trading activity.';

  assert.match(
    sanitizeMarketCopy(legacyPhrase),
    /^trading context: Price reflects consensus through trading activity\.$/i
  );
});

test('homepage and market surface keep indefinite-trading product copy', () => {
  const homeSource = read('src/routes/+page.svelte');
  const marketSurfaceSource = read('src/lib/components/cascade/MarketSurface.svelte');
  const forbiddenMechanicsCopy = new RegExp(
    ['resol' + 'ution', 'resol' + 'ved', 'market ' + 'closes', 'winner ' + 'pay' + 'out', 'or' + 'acle'].join('|'),
    'i'
  );

  assert.match(homeSource, /A live claim priced by trading activity\./);
  assert.match(homeSource, /Exited/);
  assert.doesNotMatch(homeSource, forbiddenMechanicsCopy);
  assert.match(marketSurfaceSource, /const tradingContext = \$derived\(/);
  assert.match(marketSurfaceSource, /<h3[^>]*>Trading context<\/h3>/);
  assert.doesNotMatch(marketSurfaceSource, forbiddenMechanicsCopy);
});
