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
