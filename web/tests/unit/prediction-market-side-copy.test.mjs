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

test('prediction-market surfaces avoid visible LONG/SHORT copy in Svelte sources', () => {
  const offenders = collectSvelteFiles(srcRoot)
    .map((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const matches = [...source.matchAll(/\b(LONG|SHORT)\b/g)].map((match) => match[1]);
      return matches.length > 0
        ? `${path.relative(webRoot, filePath)}: ${matches.join(', ')}`
        : null;
    })
    .filter(Boolean);

  assert.deepEqual(offenders, []);
});

test('remaining prediction-market side labels use YES/NO while preserving long/short internals', () => {
  const expectations = [
    ['src/lib/components/cascade/PortfolioPage.svelte', /position\.direction === 'long' \? 'YES' : 'NO'/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /YES \{formatProbability\(yesProbability\)\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /NO \{formatProbability\(noProbability\)\}/],
    ['src/lib/components/cascade/PaperTradePanel.svelte', /currentPosition\.side === 'long' \? 'YES' : 'NO'/],
    ['src/routes/activity/+page.svelte', /trade\.direction === 'long' \? 'YES' : 'NO'/],
    ['src/routes/builder/+page.svelte', /<option value="long">YES<\/option>/],
    ['src/routes/builder/+page.svelte', /<option value="short">NO<\/option>/],
    ['src/routes/analytics/+page.svelte', /trade\.direction === 'long' \? 'YES' : 'NO'/],
    ['src/routes/p/[identifier]/+page.svelte', /position\.direction === 'long' \? 'YES' : 'NO'/]
  ];

  for (const [relativePath, pattern] of expectations) {
    assert.match(read(relativePath), pattern, `${relativePath} should match ${pattern}`);
  }
});
