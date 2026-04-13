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
