import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('/markets route exists and uses the shared relay discovery path', () => {
  assert.equal(existsSync(path.join(webRoot, 'src/routes/markets/+page.svelte')), true);
  assert.equal(existsSync(path.join(webRoot, 'src/routes/markets/+page.server.ts')), true);

  const server = read('src/routes/markets/+page.server.ts');
  assert.match(server, /fetchRecentMarkets\(120,\s*\{\s*edition\s*\}\)/);
  assert.match(server, /fetchRecentTrades\(480,\s*\{\s*edition\s*\}\)/);
  assert.doesNotMatch(server, /api\/product|api\/market|registry/i);
});

test('/markets page renders The Column category browse surface', () => {
  const source = read('src/routes/markets/+page.svelte');

  assert.match(source, /<h1[^>]*>Markets<\/h1>/);
  assert.match(source, /Every live claim, across every category/);
  assert.match(source, /Most active/);
  assert.match(source, /Contested/);
  assert.match(source, /Under the radar/);
  assert.match(source, /All markets/);
  assert.match(source, /aria-label="Market categories"/);
  assert.match(source, /filterLiveHomepageMarkets/);
  assert.match(source, /marketUrl\(market\.slug\)/);
});

test('/markets page keeps launch copy inside current product rules', () => {
  const source = read('src/routes/markets/+page.svelte');
  const forbiddenMechanicsCopy = [
    'resol' + 'ution',
    'resol' + 'ved',
    'market ' + 'closes',
    'winner ' + 'pay' + 'out',
    'or' + 'acle'
  ];
  const rawUnitCopy = ['sa' + 'ts', 'm' + 'sats'];

  assert.doesNotMatch(source, new RegExp(forbiddenMechanicsCopy.join('|'), 'i'));
  assert.doesNotMatch(source, new RegExp(rawUnitCopy.join('|'), 'i'));
});
