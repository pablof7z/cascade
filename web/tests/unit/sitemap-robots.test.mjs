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

async function loadServerCascade() {
  return import(pathToFileURL(path.join(webRoot, 'src/lib/server/cascade.ts')).href);
}

test('sitemap route builds XML for static and market pages', () => {
  const source = read('src/routes/sitemap.xml/+server.ts');

  assert.match(source, /import type \{ RequestHandler \} from '\.\/\$types';/);
  assert.match(source, /import \{ fetchSitemapMarkets \} from '\$lib\/server\/cascade';/);
  assert.match(source, /const staticPages(?:\s*:\s*SitemapPage\[\])? = \[[\s\S]*\{ loc: origin, priority: '1\.0', changefreq: 'hourly' \},[\s\S]*\{ loc: `\$\{origin\}\/about`, priority: '0\.8', changefreq: 'monthly' \},[\s\S]*\{ loc: `\$\{origin\}\/how-it-works`, priority: '0\.8', changefreq: 'monthly' \},[\s\S]*\{ loc: `\$\{origin\}\/leaderboard`, priority: '0\.6', changefreq: 'daily' \}[\s\S]*\];/);
  assert.match(source, /const markets = await fetchSitemapMarkets\(500\);/);
  assert.match(source, /loc: `\$\{origin\}\/market\/\$\{encodeURIComponent\(market\.slug\)\}`/);
  assert.match(source, /lastmod: new Date\(market\.createdAt \* 1000\)\.toISOString\(\)\.split\('T'\)\[0\]/);
  assert.match(source, /'content-type': 'application\/xml'/);
  assert.match(source, /'cache-control': 'public, max-age=3600, s-maxage=86400'/);
});

test('fetchSitemapMarkets falls back to relays when the product feed is empty', async () => {
  const { fetchSitemapMarkets } = await loadServerCascade();

  const relayMarket = {
    id: 'relay-market',
    pubkey: 'f'.repeat(64),
    slug: 'relay-market',
    title: 'Relay Market',
    description: 'Fetched from relays',
    body: '',
    categories: [],
    topics: [],
    status: 'open',
    latestPricePpm: null,
    createdAt: 1_700_000_000,
    rawEvent: {
      id: 'relay-market',
      kind: 982,
      pubkey: 'f'.repeat(64),
      created_at: 1_700_000_000,
      content: '',
      sig: '0'.repeat(128),
      tags: [['d', 'relay-market']]
    }
  };

  const markets = await fetchSitemapMarkets(500, {
    fetchRecentMarkets: async () => [],
    fetchRecentRelayMarkets: async () => [relayMarket]
  });

  assert.equal(markets.length, 1);
  assert.equal(markets[0]?.slug, 'relay-market');
});

test('robots.txt allows indexing and points crawlers at the production sitemap', () => {
  const source = read('static/robots.txt');

  assert.match(source, /^User-agent: \*$/m);
  assert.match(source, /^Allow: \/$/m);
  assert.match(source, /^Disallow: \/onboarding$/m);
  assert.match(source, /^Disallow: \/join$/m);
  assert.match(source, /^Disallow: \/portfolio$/m);
  assert.match(source, /^Disallow: \/dashboard$/m);
  assert.match(source, /^Disallow: \/profile\/edit$/m);
  assert.match(source, /^Disallow: \/bookmarks$/m);
  assert.match(source, /^Disallow: \/analytics$/m);
  assert.match(source, /^Disallow: \/relay$/m);
  assert.match(source, /^Disallow: \/relays$/m);
  assert.match(source, /^Disallow: \/builder$/m);
  assert.match(source, /^Disallow: \/api\/$/m);
  assert.match(source, /^Disallow: \/og\/$/m);
  assert.match(source, /^Sitemap: https:\/\/cascade\.f7z\.io\/sitemap\.xml$/m);
});
