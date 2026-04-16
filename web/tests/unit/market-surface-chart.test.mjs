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

test('charts tab renders an inline SVG time-series price chart', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /const\s+chartGridLevels\s*=\s*\[0,\s*0\.25,\s*0\.5,\s*0\.75,\s*1\]/);
  assert.match(source, /<svg[\s\S]*class="price-chart-svg"[\s\S]*viewBox=\{`0 0 \$\{chartWidth\} \$\{chartHeight\}`\}/);
  assert.match(source, /<polyline[\s\S]*class=\{`price-chart-line \$\{chartTrendClass\}`\}[\s\S]*points=\{chartPolylinePoints\}/);
  assert.match(source, /\{#each chartPoints as point \(point\.id\)\}[\s\S]*<circle[\s\S]*cx=\{point\.x\}[\s\S]*cy=\{point\.y\}/);
  assert.match(source, /\{#each chartGridLevels as level \(level\)\}[\s\S]*formatProbability\(level\)/);
  assert.match(source, /price-chart-timestamps[\s\S]*formatRelativeTime\(chartStartTrade\.createdAt\)[\s\S]*formatRelativeTime\(chartEndTrade\.createdAt\)/);
  assert.match(source, /No trade history has been published for this market yet\./);
});

test('charts tab removes the legacy CSS bar chart markup and styles', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.doesNotMatch(source, /class="chart-shell"/);
  assert.doesNotMatch(source, /class="chart-step"/);
  assert.doesNotMatch(source, /class="chart-line"/);
  assert.doesNotMatch(source, /class="chart-dot"/);
  assert.doesNotMatch(source, /class="chart-bar"/);
  assert.doesNotMatch(source, /class="chart-fill"/);
  assert.doesNotMatch(source, /\.chart-shell\s*\{/);
  assert.doesNotMatch(source, /\.chart-step\s*\{/);
  assert.doesNotMatch(source, /\.chart-line\s*\{/);
  assert.doesNotMatch(source, /\.chart-dot\s*\{/);
  assert.doesNotMatch(source, /\.chart-bar\s*\{/);
  assert.doesNotMatch(source, /\.chart-fill\s*\{/);
});

test('charts tab last executed trade panel shows latest trade details and empty state', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /<h3>Last executed trade<\/h3>/);
  assert.match(
    source,
    /<h3>Last executed trade<\/h3>[\s\S]*\{#if latestTrade\}[\s\S]*<dt>Direction<\/dt>[\s\S]*latestTrade\.direction === 'long' \? 'LONG' : 'SHORT'[\s\S]*latestTrade\.type === 'buy' \? 'Buy' : 'Sell'/
  );
  assert.match(source, /<dt>Price<\/dt>[\s\S]*priceCents\(latestTrade\.probability\)/);
  assert.match(
    source,
    /<dt>Size<\/dt>[\s\S]*formatProductAmount\(latestTrade\.amount, 'usd'\)[\s\S]*valueUnitLabel/
  );
  assert.match(source, /<dt>When<\/dt>[\s\S]*formatRelativeTime\(latestTrade\.createdAt\)/);
  assert.match(source, /\{:else\}[\s\S]*No trades yet\./);
  assert.doesNotMatch(source, /<h3>Last executed trade<\/h3>[\s\S]*<dt>Current LONG<\/dt>/);
  assert.doesNotMatch(source, /<h3>Last executed trade<\/h3>[\s\S]*<dt>Current SHORT<\/dt>/);
  assert.doesNotMatch(source, /<h3>Last executed trade<\/h3>[\s\S]*<dt>Current price<\/dt>/);
});

test('market surface presents prediction market copy as LONG/SHORT while preserving internal long/short data model', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /trade\.direction === 'long' \? 'LONG' : 'SHORT'/);
  assert.match(source, /latestTrade\.direction === 'long' \? 'LONG' : 'SHORT'/);
  assert.match(source, /const summary = `\$\{longPct\}% LONG • \$\{shortPct\}% SHORT`;/);
  assert.match(source, /market-header-side-label">LONG<\/span>/);
  assert.match(source, /<span>LONG<\/span>[\s\S]*<strong class="positive">\{priceCents\(impliedProbability\)\}<\/strong>/);
  assert.match(source, /<span>SHORT<\/span>[\s\S]*<strong class="negative">\{priceCents\(oppositeProbability\)\}<\/strong>/);
  assert.match(source, /<dt>LONG flow<\/dt>/);
  assert.match(source, /<dt>SHORT flow<\/dt>/);
  assert.match(source, /\{formatProbability\(flowLong\)\} LONG/);
  assert.match(source, /<span>LONG share<\/span>/);
  assert.match(source, /\{formatProbability\(flowLong\)\} LONG/);
  assert.match(source, /<span>SHORT share<\/span>/);
  assert.match(source, /\{formatProbability\(flowShort\)\} SHORT/);
  assert.match(source, /<dt>Direction<\/dt>/);
  assert.match(source, /<dt>Price<\/dt>/);
  assert.doesNotMatch(source, /market-header-side-label">YES<\/span>/);
  assert.doesNotMatch(source, /<dt>YES flow<\/dt>/);
  assert.doesNotMatch(source, /<dt>NO flow<\/dt>/);
});
