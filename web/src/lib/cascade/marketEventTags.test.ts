import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMarketEventTags } from './marketEventTags.ts';

test('buildMarketEventTags keeps mint routing details out of market events', () => {
  const tags = buildMarketEventTags({
    title: 'Will market creators stop seeing mint plumbing?',
    slug: 'mint-plumbing-hidden',
    description: 'Users should only provide market framing.',
    category: 'AI, Economics',
    topics: 'agents, liquidity',
    linkedMarkets: [
      {
        id: 'linked-market',
        direction: 'short',
        note: 'Counterpoint from a related market.'
      }
    ]
  });

  assert.equal(
    tags.some((tag) => tag[0] === 'mint' || tag[0] === 'mint-pubkey'),
    false
  );
  assert.deepEqual(tags.slice(0, 4), [
    ['title', 'Will market creators stop seeing mint plumbing?'],
    ['d', 'mint-plumbing-hidden'],
    ['description', 'Users should only provide market framing.'],
    ['status', 'open']
  ]);
  assert.deepEqual(tags.slice(4), [
    ['c', 'ai'],
    ['c', 'economics'],
    ['t', 'agents'],
    ['t', 'liquidity'],
    ['e', 'linked-market', '', 'reference'],
    ['signal-direction', 'linked-market', 'short'],
    ['signal-note', 'linked-market', 'Counterpoint from a related market.']
  ]);
});
