import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchMarketBySlug } from './cascade.ts';

function sampleMarketEvent(slug: string, id = `event-${slug}`) {
  return {
    id,
    kind: 982,
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    content: 'A market body',
    sig: '0'.repeat(128),
    tags: [
      ['d', slug],
      ['title', `Market ${slug}`],
      ['description', `Description for ${slug}`]
    ]
  };
}

function sampleTradeEvent(args: { marketId: string; pricePpm: number; createdAt: number; id: string }) {
  return {
    id: args.id,
    kind: 983,
    pubkey: 'e'.repeat(64),
    created_at: args.createdAt,
    content: '',
    sig: '1'.repeat(128),
    tags: [
      ['e', args.marketId],
      ['direction', 'long'],
      ['type', 'buy'],
      ['amount', '100'],
      ['price', String(args.pricePpm)],
      ['unit', 'usd']
    ]
  };
}

test('fetchMarketBySlug uses product detail raw_event when available', async () => {
  const fetchProductJson = async <T>() =>
    ({
      market: {
        raw_event: sampleMarketEvent('public-market')
      }
    }) as T;

  const market = await fetchMarketBySlug('public-market', {
    fetchProductJson,
    fetchRelayMarketBySlug: async () => {
      throw new Error('relay fallback should not run when product detail exists');
    }
  });

  assert.equal(market?.slug, 'public-market');
  assert.equal(market?.title, 'Market public-market');
});

test('fetchMarketBySlug carries the latest price from product detail trades when available', async () => {
  const marketEvent = sampleMarketEvent('priced-market', 'market-priced');
  const fetchProductJson = async <T>() =>
    ({
      market: {
        raw_event: marketEvent
      },
      trades: [
        sampleTradeEvent({ marketId: marketEvent.id, pricePpm: 410_000, createdAt: 1_700_000_100, id: 'trade-1' }),
        sampleTradeEvent({ marketId: marketEvent.id, pricePpm: 670_000, createdAt: 1_700_000_200, id: 'trade-2' })
      ]
    }) as T;

  const market = await fetchMarketBySlug('priced-market', {
    fetchProductJson,
    fetchRelayMarketBySlug: async () => {
      throw new Error('relay fallback should not run when product detail exists');
    }
  });

  assert.equal(market?.latestPricePpm, 670_000);
});

test('fetchMarketBySlug falls back to relay lookup when product detail is unavailable', async () => {
  const fetchProductJson = async <T>() => null as T | null;

  const market = await fetchMarketBySlug('featured-market', {
    fetchProductJson,
    fetchRelayMarketBySlug: async () => sampleMarketEvent('featured-market', 'relay-market')
  });

  assert.equal(market?.id, 'relay-market');
  assert.equal(market?.slug, 'featured-market');
  assert.equal(market?.title, 'Market featured-market');
});
