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

test('analytics server load keeps the initial SSR relay payload small', () => {
  const source = read('src/routes/analytics/+page.server.ts');

  assert.match(source, /const ANALYTICS_MARKET_LIMIT = 20;/);
  assert.match(source, /const ANALYTICS_DISCUSSION_LIMIT = 20;/);
  assert.match(source, /const ANALYTICS_TRADE_LIMIT = 50;/);
  assert.match(source, /function take<T>\(items: T\[], limit: number\): T\[] \{/);
  assert.match(source, /fetchRecentMarkets\(ANALYTICS_MARKET_LIMIT\)/);
  assert.match(source, /fetchRecentDiscussions\(ANALYTICS_DISCUSSION_LIMIT\)/);
  assert.match(source, /fetchRecentTrades\(ANALYTICS_TRADE_LIMIT\)/);
  assert.match(source, /markets: take\(markets, ANALYTICS_MARKET_LIMIT\)\.map/);
  assert.match(source, /discussions: take\(discussions, ANALYTICS_DISCUSSION_LIMIT\)\.map/);
  assert.match(source, /trades: take\(trades, ANALYTICS_TRADE_LIMIT\)\.map/);

  assert.doesNotMatch(source, /fetchRecentMarkets\(100\)/);
  assert.doesNotMatch(source, /fetchRecentDiscussions\(160\)/);
  assert.doesNotMatch(source, /fetchRecentTrades\(400\)/);
});
