import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.join(webRoot, 'src');

function collectSvelteFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSvelteFiles(entryPath);
    return entry.name.endsWith('.svelte') ? [entryPath] : [];
  });
}

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('prediction-market surfaces keep visible LONG/SHORT copy in the active trading UI', () => {
  const expectations = [
    ['src/lib/components/cascade/PortfolioPage.svelte', /\{position\.direction === 'long' \? 'LONG' : 'SHORT'\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /LONG \{formatProbability\(yesProbability\)\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /SHORT \{formatProbability\(noProbability\)\}/],
    ['src/lib/components/cascade/MarketSurface.svelte', /<span[^>]*>LONG<\/span>/],
    ['src/routes/activity/+page.svelte', /trade\.direction === 'long' \? 'LONG' : 'SHORT'/],
    ['src/routes/analytics/+page.svelte', /trade\.direction === 'long' \? 'LONG' : 'SHORT'/],
    ['src/routes/p\/\[identifier\]\/\+page\.svelte', /LONG\/SHORT split/]
  ];

  for (const [relativePath, pattern] of expectations) {
    assert.match(read(relativePath), pattern, `${relativePath} should match ${pattern}`);
  }
});

test('remaining prediction-market side labels use LONG/SHORT while preserving long/short internals', () => {
  const expectations = [
    ['src/lib/components/cascade/PortfolioPage.svelte', /position\.direction === 'long' \? 'LONG' : 'SHORT'/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /LONG \{formatProbability\(yesProbability\)\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /SHORT \{formatProbability\(noProbability\)\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /currentPosition\.side === 'long' \? 'LONG' : 'SHORT'/],
    ['src/routes/activity/+page.svelte', /trade\.direction === 'long' \? 'LONG' : 'SHORT'/],
    ['src/routes/builder/+page.svelte', /<option value="long">LONG<\/option>/],
    ['src/routes/builder/+page.svelte', /<option value="short">SHORT<\/option>/],
    ['src/routes/analytics/+page.svelte', /trade\.direction === 'long' \? 'LONG' : 'SHORT'/],
    ['src/routes/p/[identifier]/+page.svelte', /position\.direction === 'long' \? 'LONG' : 'SHORT'/]
  ];

  for (const [relativePath, pattern] of expectations) {
    assert.match(read(relativePath), pattern, `${relativePath} should match ${pattern}`);
  }

  assert.doesNotMatch(read('src/routes/builder/+page.svelte'), /<option value="long">YES<\/option>/);
  assert.doesNotMatch(read('src/routes/builder/+page.svelte'), /<option value="short">NO<\/option>/);
});
