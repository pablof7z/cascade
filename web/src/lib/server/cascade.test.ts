import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchMarketBySlug } from './cascade.ts';

function sampleMarketEvent(slug: string, id = `event-${slug}`, kind = 982) {
  return {
    id,
    kind,
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

function sampleTradeEvent(args: { marketId: string; direction: 'long' | 'short'; pricePpm: number; createdAt: number; id: string; kind?: number }) {
  return {
    id: args.id,
    kind: args.kind ?? 983,
    pubkey: 'e'.repeat(64),
    created_at: args.createdAt,
    content: '',
    sig: '1'.repeat(128),
    tags: [
      ['e', args.marketId],
      ['direction', args.direction],
      ['type', 'buy'],
      ['amount', '100'],
      ['price', String(args.pricePpm)],
      ['unit', 'usd']
    ]
  };
}

test('fetchMarketBySlug uses relay trades to set the latest yes price', async () => {
  const marketEvent = sampleMarketEvent('priced-market', 'market-priced');

  const market = await fetchMarketBySlug('priced-market', {
    fetchRelayMarketBySlug: async () => marketEvent,
    fetchRelayTradesForMarket: async () => [
      {
        id: 'trade-1',
        pubkey: 'e'.repeat(64),
        marketId: marketEvent.id,
        amount: 100,
        unit: 'usd',
        direction: 'long',
        type: 'buy',
        pricePpm: 410_000,
        probability: 0.41,
        createdAt: 1_700_000_100,
        rawEvent: sampleTradeEvent({ marketId: marketEvent.id, direction: 'long', pricePpm: 410_000, createdAt: 1_700_000_100, id: 'trade-1' })
      },
      {
        id: 'trade-2',
        pubkey: 'e'.repeat(64),
        marketId: marketEvent.id,
        amount: 100,
        unit: 'usd',
        direction: 'long',
        type: 'buy',
        pricePpm: 670_000,
        probability: 0.67,
        createdAt: 1_700_000_200,
        rawEvent: sampleTradeEvent({ marketId: marketEvent.id, direction: 'long', pricePpm: 670_000, createdAt: 1_700_000_200, id: 'trade-2' })
      }
    ]
  });

  assert.equal(market?.slug, 'priced-market');
  assert.equal(market?.latestPricePpm, 670_000);
});

test('fetchMarketBySlug uses practice event kinds when edition is signet', async () => {
  const marketEvent = sampleMarketEvent('practice-market', 'practice-market-id', 980);

  const market = await fetchMarketBySlug('practice-market', {
    edition: 'signet',
    fetchRelayMarketBySlug: async () => marketEvent,
    fetchRelayTradesForMarket: async () => [
      {
        id: 'practice-trade',
        pubkey: 'e'.repeat(64),
        marketId: marketEvent.id,
        amount: 100,
        unit: 'usd',
        direction: 'long',
        type: 'buy',
        pricePpm: 520_000,
        probability: 0.52,
        createdAt: 1_700_000_100,
        rawEvent: sampleTradeEvent({
          marketId: marketEvent.id,
          direction: 'long',
          pricePpm: 520_000,
          createdAt: 1_700_000_100,
          id: 'practice-trade',
          kind: 981
        })
      }
    ]
  });

  assert.equal(market?.slug, 'practice-market');
  assert.equal(market?.latestPricePpm, 520_000);
});

test('fetchMarketBySlug normalizes short-side relay trade prices back to yes probability', async () => {
  const marketEvent = sampleMarketEvent('short-latest', 'market-short');

  const market = await fetchMarketBySlug('short-latest', {
    fetchRelayMarketBySlug: async () => marketEvent,
    fetchRelayTradesForMarket: async () => [
      {
        id: 'trade-short',
        pubkey: 'e'.repeat(64),
        marketId: marketEvent.id,
        amount: 100,
        unit: 'usd',
        direction: 'short',
        type: 'buy',
        pricePpm: 330_000,
        probability: 0.33,
        createdAt: 1_700_000_300,
        rawEvent: sampleTradeEvent({ marketId: marketEvent.id, direction: 'short', pricePpm: 330_000, createdAt: 1_700_000_300, id: 'trade-short' })
      }
    ]
  });

  assert.equal(market?.slug, 'short-latest');
  assert.equal(market?.latestPricePpm, 670_000);
});

test('fetchMarketBySlug returns null when relay lookup misses', async () => {
  const market = await fetchMarketBySlug('missing-market', {
    fetchRelayMarketBySlug: async () => null,
    fetchRelayTradesForMarket: async () => {
      throw new Error('trade lookup should not run when the market is missing');
    }
  });

  assert.equal(market, null);
});

test('fetchMarketBySlug hides pending markets until the first mint-authored trade exists', async () => {
  const marketEvent = sampleMarketEvent('pending-market', 'market-pending');

  const market = await fetchMarketBySlug('pending-market', {
    fetchRelayMarketBySlug: async () => marketEvent,
    fetchRelayTradesForMarket: async () => []
  });

  assert.equal(market, null);
});
