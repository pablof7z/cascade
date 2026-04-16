import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPublicProfileDiscussionEntries,
  buildPublicProfilePositionStats,
  formatProfilePositionSummary,
  formatProfileProbability
} from '../../src/lib/cascade/profile.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('public profile helpers compute condensed position stats and entry price summaries', () => {
  const positions = [
    { id: 'position-1', direction: 'long', quantity: 42, entryPrice: 0.67 },
    { id: 'position-2', direction: 'short', quantity: 18, entryPrice: 0.42 },
    { id: 'position-3', direction: 'long', quantity: 6, entryPrice: 0.54 }
  ];

  const stats = buildPublicProfilePositionStats(positions);

  assert.deepEqual(stats, {
    total: 3,
    longCount: 2,
    shortCount: 1,
    splitLabel: 'LONG 2 · SHORT 1',
    averageEntryPrice: (0.67 + 0.42 + 0.54) / 3
  });
  assert.equal(formatProfileProbability(stats.averageEntryPrice), '54.3%');
  assert.equal(formatProfilePositionSummary(positions[0]), 'LONG · 42 units @ 67%');
  assert.equal(formatProfilePositionSummary(positions[1]), 'SHORT · 18 units @ 42%');
});

test('public profile helpers build discussion rows for threads the user started', () => {
  const markets = [
    {
      id: 'market-1',
      slug: 'fed-cut',
      title: 'Will the Fed cut before summer?',
      description: '',
      body: '',
      categories: [],
      topics: [],
      status: 'open',
      latestPricePpm: null,
      createdAt: 1_700_000_000,
      pubkey: 'f'.repeat(64),
      rawEvent: { id: 'market-1', kind: 982, pubkey: 'f'.repeat(64), created_at: 1_700_000_000, content: '', sig: '0'.repeat(128), tags: [['d', 'fed-cut']] }
    }
  ];
  const discussions = [
    {
      id: 'reply-1',
      pubkey: 'a'.repeat(64),
      marketId: 'market-1',
      rootId: 'market-1',
      replyTo: 'thread-1',
      subject: 'Follow-up',
      content: 'A later reply should not appear in the started threads list.',
      createdAt: 1_700_000_300,
      rawEvent: { id: 'reply-1', kind: 1111, pubkey: 'a'.repeat(64), created_at: 1_700_000_300, content: '', sig: '1'.repeat(128), tags: [] }
    },
    {
      id: 'thread-2',
      pubkey: 'a'.repeat(64),
      marketId: 'market-1',
      rootId: 'market-1',
      replyTo: 'market-1',
      subject: undefined,
      content: 'The latest macro print still looks too soft to sustain current odds.',
      createdAt: 1_700_000_200,
      rawEvent: { id: 'thread-2', kind: 1111, pubkey: 'a'.repeat(64), created_at: 1_700_000_200, content: '', sig: '2'.repeat(128), tags: [] }
    },
    {
      id: 'thread-1',
      pubkey: 'a'.repeat(64),
      marketId: 'market-1',
      rootId: 'market-1',
      replyTo: 'market-1',
      subject: 'Why the market is early',
      content: 'Rates are moving faster than the headline narrative suggests.',
      createdAt: 1_700_000_100,
      rawEvent: { id: 'thread-1', kind: 1111, pubkey: 'a'.repeat(64), created_at: 1_700_000_100, content: '', sig: '3'.repeat(128), tags: [] }
    }
  ];

  const entries = buildPublicProfileDiscussionEntries(discussions, markets);

  assert.deepEqual(
    entries.map((entry) => ({ id: entry.id, title: entry.title, marketLabel: entry.marketLabel, marketHref: entry.marketHref, threadHref: entry.threadHref })),
    [
      {
        id: 'thread-2',
        title: 'The latest macro print still looks too soft to sustain current odds.',
        marketLabel: 'Will the Fed cut before summer?',
        marketHref: '/market/fed-cut',
        threadHref: '/market/fed-cut/discussion/thread-2'
      },
      {
        id: 'thread-1',
        title: 'Why the market is early',
        marketLabel: 'Will the Fed cut before summer?',
        marketHref: '/market/fed-cut',
        threadHref: '/market/fed-cut/discussion/thread-1'
      }
    ]
  );
});

test('public profile page wires richer stats, entry pricing, and market links into the route', () => {
  const pageSource = read('src/routes/p/[identifier]/+page.svelte');
  const serverSource = read('src/routes/p/[identifier]/+page.server.ts');
  const cascadeServerSource = read('src/lib/server/cascade.ts');

  assert.match(pageSource, /buildPublicProfilePositionStats/);
  assert.match(pageSource, /formatProfilePositionSummary\(position\)/);
  assert.match(pageSource, /<span>Positions<\/span>/);
  assert.match(pageSource, /<span>LONG\/SHORT split<\/span>/);
  assert.match(pageSource, /<span>Avg entry<\/span>/);
  assert.match(pageSource, /<h2>Discussions<\/h2>/);
  assert.match(pageSource, /discussionEntries/);
  assert.match(pageSource, /const positionMarketList = \$derived\(data\.positionMarkets as MarketRecord\[\]\);/);
  assert.match(pageSource, /const positionMarketMap = \$derived\.by\(\(\) => \{[\s\S]*for \(const m of positionMarketList\) map\.set\(m\.id, m\);[\s\S]*\}\);/);
  assert.match(pageSource, /\{@const positionMarket = positionMarketMap\.get\(position\.marketId\)\}[\s\S]*<a class="profile-row" href=\{positionMarket \? marketUrl\(positionMarket\.slug\) : undefined\}>/);
  assert.doesNotMatch(pageSource, /<div class="profile-kicker">Profile<\/div>/);

  assert.match(serverSource, /fetchDiscussionsByPubkey/);
  assert.match(serverSource, /fetchDiscussionsByPubkey\(user\.pubkey,\s*50,\s*\{\s*edition\s*\}\)/);
  assert.match(serverSource, /fetchMarketsByIds/);
  assert.match(serverSource, /discussionMarkets/);
  assert.match(serverSource, /fetchMarketsByAuthor\(user\.pubkey,\s*48,\s*\{\s*edition\s*\}\)/);
  assert.match(serverSource, /const positionMarkets = await fetchMarketsByIds\(positions\.map\(\(p\) => p\.marketId\),\s*\{\s*edition\s*\}\);/);
  assert.match(serverSource, /positionMarkets,/);

  assert.match(cascadeServerSource, /export async function fetchDiscussionsByPubkey\(\s*pubkey: string,\s*limit = 50,\s*options: CascadeEditionOption = \{\}\s*\)/);
  assert.match(cascadeServerSource, /export async function fetchMarketsByIds\(\s*marketIds: readonly string\[\],\s*options: CascadeEditionOption = \{\}\s*\)/);
  assert.match(cascadeServerSource, /authors:\s*\[pubkey\]/);
});

test('web package exposes bun run test for unit coverage', () => {
  const packageSource = read('package.json');

  assert.match(packageSource, /"test"\s*:\s*"bun run test:unit"/);
});
