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

test('homepage source wires client-side search state, input UI, and filtered results', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /let\s+searchQuery\s*=\s*\$state\(''\);/);
  assert.match(source, /const\s+filteredMarkets\s*=\s*\$derived\.by\(\(\)\s*=>\s*filterHomepageMarkets\(markets,\s*searchQuery\)\);/);
  assert.match(source, /const\s+hasActiveMarketSearch\s*=\s*\$derived\([^)]*searchQuery\.trim\(\)\.length\s*>\s*0[^)]*\);/);
  assert.match(source, /<div class="mkts-search">[\s\S]*placeholder="Search markets…"[\s\S]*bind:value=\{searchQuery\}/);
  assert.match(source, /mkts-search-count[\s\S]*\{searchResultCountLabel\}/);
  assert.match(source, /\{#if hasActiveMarketSearch\}[\s\S]*\{#each filteredMarkets as market \(market\.id\)\}[\s\S]*\{:else\}[\s\S]*<h2>Most Active<\/h2>/);
});

test('homepage source uses how-it-works CTA and probability-driven YES/NO labels', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /<a class="hero-secondary" href="\/how-it-works">How it works →<\/a>/);
  assert.match(
    source,
    /<span class="featured-side">\{probabilityForMarket\(featuredMarket\.id\) >= 0\.5 \? 'YES' : 'NO'\}<\/span>/
  );
  assert.match(
    source,
    /<span class="lead-side">\{probabilityForMarket\(primaryTrending\.id\) >= 0\.5 \? 'YES' : 'NO'\}<\/span>/
  );
});

test('homepage source keeps side panels dense with price and activity signals', () => {
  const source = read('src/routes/+page.svelte');
  const underTheRadar = sectionBetween(source, '<h2>Under the radar</h2>', '<h2>Most Contested</h2>');
  const mostContested = sectionBetween(source, '<h2>Most Contested</h2>', '<h2>New This Week</h2>');
  const newThisWeek = sectionBetween(source, '<h2>New This Week</h2>', '<h2>Live Debate</h2>');

  assert.ok(
    underTheRadar.includes(
      '<span>{formatSats(tradeSummaries.get(market.id)?.grossVolume ?? 0)} vol · {discussionCounts.get(market.id) ?? 0} posts</span>'
    )
  );
  assert.ok(
    mostContested.includes(
      '<span>Tight spread {spreadForMarket(market.id)} · {tradeSummaries.get(market.id)?.tradeCount ?? 0} trades</span>'
    )
  );
  assert.ok(newThisWeek.includes('<span class="mono-cell">{centsForMarket(market.id)}</span>'));
  assert.ok(
    newThisWeek.includes(
      '<span>{formatRelativeTime(market.createdAt)} · {tradeSummaries.get(market.id)?.tradeCount ?? 0} trades</span>'
    )
  );
});
