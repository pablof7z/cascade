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

test('market SEO points og:image at the market-specific OG endpoint', () => {
  const source = read('src/lib/seo.ts');

  assert.match(source, /url:\s*new URL\(`\/og\/market\/\$\{encodeURIComponent\(args\.market\.slug\)\}`,[\s\S]*args\.url\.origin\)\.toString\(\)/);
  assert.match(source, /alt:\s*`\$\{args\.market\.title\} preview`/);
  assert.match(source, /width:\s*1200/);
  assert.match(source, /height:\s*630/);
});

test('market OG route fetches by slug, renders PNG, and redirects to the default image on failure', () => {
  const source = read('src/routes/og/market/[slug]/+server.ts');

  assert.match(source, /import \{ fetchMarketBySlug \} from '\$lib\/server\/cascade';/);
  assert.match(source, /import \{ renderMarketOgImage \} from '\$lib\/server\/og';/);
  assert.match(source, /const market = await fetchMarketBySlug\(params\.slug, \{ edition: locals\.cascadeEdition \}\);/);
  assert.match(source, /const image = await renderMarketOgImage\(\{ market \}\);/);
  assert.match(source, /'content-type': 'image\/png'/);
  assert.match(source, /Response\.redirect\(new URL\('\/og-default\.png', url\), 307\)/);
});

test('market OG renderer derives a probability badge and market copy from market fields', () => {
  const source = read('src/lib/server/og.ts');

  assert.match(source, /export async function renderMarketOgImage\(args:\s*\{[\s\S]*market:\s*MarketRecord;[\s\S]*\}\): Promise<Buffer>/);
  assert.match(source, /const palette = paletteFor\(args\.market\.id\);/);
  assert.match(source, /const badge = args\.market\.latestPricePpm \? `\$\{Math\.round\(args\.market\.latestPricePpm \/ 10000\)\}%` : 'OPEN';/);
  assert.match(source, /const titleLines = wrapText\(args\.market\.title, 28, 3\);/);
  assert.match(source, /const summary = previewSnippet\(args\.market\.description \|\| args\.market\.body, 'Prediction market on Cascade\.'\);/);
  assert.match(source, /const summaryLines = wrapText\(summary, 52, 2\);/);
  assert.match(source, /text: 'CASCADE'/);
  assert.match(source, /text: 'Prediction Market'/);
  assert.match(source, /text: 'cascade\.market'/);
});
