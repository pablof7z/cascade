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

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing section start: ${startMarker}`);

  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing section end: ${endMarker}`);

  return source.slice(start, end);
}

async function loadSearchHelpers() {
  return import(pathToFileURL(path.join(webRoot, 'src/routes/homepage-market-search.ts')).href);
}

test('filterHomepageMarkets matches title and description with trimmed case-insensitive queries', async () => {
  const { filterHomepageMarkets } = await loadSearchHelpers();

  const markets = [
    {
      id: 'market-1',
      title: 'Will Bitcoin reach $200k?',
      description: 'Tracks the BTC price through year end.'
    },
    {
      id: 'market-2',
      title: 'Will inflation cool by September?',
      description: 'Watch CPI prints and Fed commentary.'
    },
    {
      id: 'market-3',
      title: 'Will Stripe add support for stablecoins?',
      description: 'Payments infra and treasury experimentation.'
    }
  ];

  assert.deepEqual(
    filterHomepageMarkets(markets, '  btc  ').map((market) => market.id),
    ['market-1']
  );
  assert.deepEqual(
    filterHomepageMarkets(markets, 'fed').map((market) => market.id),
    ['market-2']
  );
  assert.deepEqual(
    filterHomepageMarkets(markets, 'STABLECOINS').map((market) => market.id),
    ['market-3']
  );
  assert.deepEqual(filterHomepageMarkets(markets, '   '), markets);
});

test('formatHomepageMarketMatchCount uses singular and plural labels', async () => {
  const { formatHomepageMarketMatchCount } = await loadSearchHelpers();

  assert.equal(formatHomepageMarketMatchCount(1), '1 market matched');
  assert.equal(formatHomepageMarketMatchCount(4), '4 markets matched');
});

test('filterLiveHomepageMarkets hides markets until a public trade exists', async () => {
  const { filterLiveHomepageMarkets } = await loadSearchHelpers();

  const markets = [
    { id: 'market-live', title: 'Live market', description: 'Has at least one trade.' },
    { id: 'market-pending', title: 'Pending market', description: 'Published but not live yet.' }
  ];
  const trades = [{ marketId: 'market-live' }];

  assert.deepEqual(
    filterLiveHomepageMarkets(markets, trades).map((market) => market.id),
    ['market-live']
  );
});

test('filterLiveHomepageMarkets skips trade filter when skipTradeFilter is true', async () => {
  const { filterLiveHomepageMarkets } = await loadSearchHelpers();

  const markets = [
    { id: 'market-live', title: 'Live market', description: 'Has at least one trade.' },
    { id: 'market-pending', title: 'Pending market', description: 'Published but not live yet.' }
  ];
  const trades = [{ marketId: 'market-live' }];

  assert.deepEqual(
    filterLiveHomepageMarkets(markets, trades, { skipTradeFilter: true }).map((market) => market.id),
    ['market-live', 'market-pending']
  );
});

test('filterLiveHomepageMarkets still strips test markets in practice mode', async () => {
  const { filterLiveHomepageMarkets } = await loadSearchHelpers();

  const markets = [
    { id: 'market-real', title: 'Real practice market', description: 'Valid.' },
    { id: 'market-test', title: 'Public paper market 1776275085367-5049', description: 'E2E test fixture.' }
  ];

  assert.deepEqual(
    filterLiveHomepageMarkets(markets, [], { skipTradeFilter: true }).map((market) => market.id),
    ['market-real']
  );
});

test('homepage source renders The Column compose and feed controls', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /let\s+noteDraft\s*=\s*\$state\(''\);/);
  assert.match(source, /placeholder="What's on your mind\?"/);
  assert.match(source, /bind:value=\{noteDraft\}/);
  assert.match(source, /<button[\s\S]*Add image[\s\S]*<\/button>/);
  assert.match(source, /<button[\s\S]*Link market[\s\S]*<\/button>/);
  assert.match(source, /<button[\s\S]*Attach stake[\s\S]*<\/button>/);
  assert.match(source, /disabled=\{!canPost\}>Post<\/button>/);
  assert.match(source, /<option value="for-you">For you<\/option>/);
  assert.match(source, /<option value="following">Following<\/option>/);
  assert.match(source, /<option value="subscribed">Subscribed<\/option>/);
  assert.match(source, /<option value="watchlist">Watchlist<\/option>/);
  assert.match(source, /<button[\s\S]*>\s*All\s*<\/button>/);
  assert.match(source, /<button[\s\S]*>\s*Notes\s*<\/button>/);
  assert.match(source, /<button[\s\S]*>\s*Publications\s*<\/button>/);
  assert.doesNotMatch(source, /Search markets/);
  assert.doesNotMatch(source, /Start Trading/);
});

test('homepage source builds a mixed feed from relay market, trade, and discussion events', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /import \{\s*filterLiveHomepageMarkets\s*\} from '\.\/homepage-market-search';/);
  assert.match(
    source,
    /const tradeFeed = ndk\.\$subscribe\(\(\) => \{[\s\S]*if \(!browser\) return undefined;[\s\S]*filters: \[\{ kinds: \[eventKinds\.trade\], limit: 240 \}\][\s\S]*\}\);/
  );
  assert.match(
    source,
    /const trades = \$derived\.by\(\(\) => \{[\s\S]*return mergeRawEvents\(data\.trades, tradeFeed\.events\)[\s\S]*\.map\(\(event\) => parseTradeEvent\(event, selectedEdition\)\)[\s\S]*\.filter\(\(trade\): trade is TradeRecord => Boolean\(trade\)\)/
  );
  assert.match(
    source,
    /return filterLiveHomepageMarkets\([\s\S]*\.map\(\(event\) => parseMarketEvent\(event, selectedEdition\)\)[\s\S]*\.filter\(\(market\): market is MarketRecord => Boolean\(market\)\)[\s\S]*,\s*trades\s*,\s*\{ skipTradeFilter: isPracticeEdition \}[\s\S]*\)[\s\S]*\.sort\(\(left, right\) => right\.createdAt - left\.createdAt\);/
  );
  assert.match(source, /const discussionFeed = ndk\.\$subscribe/);
  assert.match(source, /parseDiscussionEvent\(event, selectedEdition\)/);
  assert.match(source, /type:\s*'claim'/);
  assert.match(source, /type:\s*'trade'/);
  assert.match(source, /type:\s*'discussion'/);
  assert.match(source, /const\s+visibleFeedItems\s*=\s*\$derived\.by/);
  assert.match(source, /contentFilter === 'publications'/);
  assert.match(source, /contentFilter === 'notes'/);
});

test('homepage feed actions navigate to market surfaces without inline trading execution', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /href=\{marketUrl\(item\.market\.slug\)\}/);
  assert.match(source, /href=\{marketDiscussionUrl\(item\.market\.slug\)\}/);
  assert.match(source, /href=\{threadUrl\(item\.market\.slug, item\.discussion\.id\)\}/);
  assert.match(source, /Back \{leadingSideLabel\(item\.market\)\} \{leadingSideCents\(item\.market\)\}¢/);
  assert.doesNotMatch(source, /PaperTradePanel/);
  assert.doesNotMatch(source, /fetch\(['"]\/api\/trades/);
  assert.doesNotMatch(source, /executeTrade|submitTrade|buyQuote|sellQuote/);
});

test('homepage empty state points new users toward markets', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /You're not following anyone yet\./);
  assert.match(source, /head to Markets to see what's live/);
  assert.match(source, /href="\/markets">Browse markets<\/a>/);
  assert.match(source, /<h2 class="font-tight text-lg font-bold">Up next<\/h2>/);
});
