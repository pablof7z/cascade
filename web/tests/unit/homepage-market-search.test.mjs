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
  assert.match(source, /<input[\s\S]*placeholder="Search markets…"/);
  assert.match(source, /bind:value=\{searchQuery\}/);
  assert.match(source, /\{#if hasActiveMarketSearch\}[\s\S]*\{searchResultCountLabel\}/);
  assert.match(source, /\{#if filteredMarkets\.length > 0\}[\s\S]*\{#each filteredMarkets as market \(market\.id\)\}/);
  assert.match(source, /\{:else\}[\s\S]*<h2 class="text-3xl font-bold tracking-tight">Most Active<\/h2>/);
});

test('homepage source uses how-it-works CTA and probability-driven LONG/SHORT labels', () => {
  const source = read('src/routes/+page.svelte');

  assert.match(source, /<a class="text-sm text-neutral-400 hover:text-white transition-colors" href="\/how-it-works">How it works →<\/a>/);
  assert.match(
    source,
    /<span class="badge badge-success badge-outline">\{probabilityForMarket\(featuredMarket\.id\) >= 0\.5 \? 'LONG' : 'SHORT'\}<\/span>/
  );
  assert.match(
    source,
    /<span class="badge badge-success badge-outline">\{probabilityForMarket\(primaryTrending\.id\) >= 0\.5 \? 'LONG' : 'SHORT'\}<\/span>/
  );
});

test('homepage source keeps side panels dense with price and activity signals', () => {
  const source = read('src/routes/+page.svelte');
  const underTheRadar = sectionBetween(
    source,
    '<h2 class="text-3xl font-bold tracking-tight">Under the radar</h2>',
    '<h2 class="text-3xl font-bold tracking-tight">Most Contested</h2>'
  );
  const mostContested = sectionBetween(
    source,
    '<h2 class="text-3xl font-bold tracking-tight">Most Contested</h2>',
    '<h2 class="text-3xl font-bold tracking-tight">New This Week</h2>'
  );
  const newThisWeek = sectionBetween(
    source,
    '<h2 class="text-3xl font-bold tracking-tight">New This Week</h2>',
    '<h2 class="text-3xl font-bold tracking-tight">Live Debate</h2>'
  );

  assert.ok(underTheRadar.includes('{centsForMarket(market.id)}'));
  assert.ok(underTheRadar.includes('{formatProductAmount(tradeSummaries.get(market.id)?.grossVolume ?? 0, \'usd\')}'));
  assert.ok(underTheRadar.includes('{discussionCounts.get(market.id) ?? 0}'));
  assert.ok(mostContested.includes('{spreadForMarket(topDisputed.id)}'));
  assert.ok(mostContested.includes("{probabilityForMarket(topDisputed.id) >= 0.5 ? 'LONG' : 'SHORT'}"));
  assert.ok(newThisWeek.includes("by {authorLabel(market.pubkey)} · {formatRelativeTime(market.createdAt)}"));
  assert.ok(source.includes('<h2 class="text-3xl font-bold tracking-tight">Live Debate</h2>'));
});
