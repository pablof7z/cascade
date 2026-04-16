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

test('leaderboard page headline and tabs match the leaderboard surfaces', () => {
  const source = read('src/routes/leaderboard/+page.svelte');

  assert.match(source, /type LeaderboardTab = 'Top Creators' \| 'Top Traders' \| 'Most Bookmarked';/);
  assert.match(source, /const tabs: LeaderboardTab\[] = \['Top Creators', 'Top Traders', 'Most Bookmarked'\];/);
  assert.match(source, /<h1>Leaderboard<\/h1>/);
  assert.match(source, /<p>Top market creators and the most-followed questions on Cascade\.<\/p>/);
  assert.doesNotMatch(source, /Who's winning/);
  assert.doesNotMatch(source, /The traders with the best track record\. Public positions, real results\./);
  assert.match(
    source,
    /\{#if activeTab === 'Top Traders'\}[\s\S]*\{#each traderRows as row, index \(row\.pubkey\)\}[\s\S]*<strong>\{label\(row\.pubkey\)\}<\/strong>[\s\S]*<p>\{row\.tradeCount\} trade\{row\.tradeCount === 1 \? '' : 's'\} placed<\/p>[\s\S]*<strong>\{row\.tradeCount\}<\/strong>[\s\S]*<span>Trades<\/span>/
  );
});

test('leaderboard page uses a cached trade sample without a live trade subscription', () => {
  const source = read('src/routes/leaderboard/+page.svelte');
  const serverSource = read('src/routes/leaderboard/+page.server.ts');

  assert.doesNotMatch(source, /const tradeFeed = ndk\.\$subscribe/);
  assert.doesNotMatch(source, /CASCADE_TRADE_KIND/);
  assert.doesNotMatch(source, /tradeFeed\.events/);
  assert.match(
    source,
    /const trades = \$derived\.by\(\(\) => \{[\s\S]*return \(data\.trades \?\? \[\]\)[\s\S]*\.map\(parseTradeEvent\)[\s\S]*\.filter\(\(trade\): trade is TradeRecord => Boolean\(trade\)\)[\s\S]*\.sort\(\(left, right\) => right\.createdAt - left\.createdAt\);[\s\S]*\}\);/
  );
  assert.match(serverSource, /const LEADERBOARD_TRADE_SAMPLE_LIMIT = 80;/);
  assert.match(serverSource, /fetchRecentTrades\(LEADERBOARD_TRADE_SAMPLE_LIMIT\)/);
  assert.doesNotMatch(serverSource, /fetchRecentTrades\(240\)/);
  assert.match(serverSource, /\.\.\.trades\.map\(\(trade\) => trade\.pubkey\)/);
  assert.match(serverSource, /trades: trades\.map\(\(trade\) => trade\.rawEvent as NostrEvent\)/);
  assert.match(
    serverSource,
    /description: 'Top market creators, active traders, and the most-bookmarked questions on Cascade\.'/
  );
});
