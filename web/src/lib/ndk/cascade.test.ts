import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CASCADE_DISCUSSION_KIND,
  CASCADE_SIGNET_MARKET_KIND,
  CASCADE_SIGNET_TRADE_KIND,
  CASCADE_POSITION_KIND,
  CASCADE_TRADE_KIND,
  buildDiscussionThreads,
  buildThreadReplyTags,
  getCascadeEventKinds,
  parseMarketEvent,
  parsePositionEvent,
  parseTradeEvent,
  yesPricePpmFromTrade,
  type DiscussionRecord
} from './cascade.ts';

test('parseTradeEvent accepts long and short directions', () => {
  const trade = parseTradeEvent({
    id: 'trade-long',
    kind: CASCADE_TRADE_KIND,
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    content: '',
    sig: '0'.repeat(128),
    tags: [
      ['e', 'market-1'],
      ['direction', 'long'],
      ['type', 'buy'],
      ['amount', '2500'],
      ['price', '610000'],
      ['unit', 'usd']
    ]
  });

  assert.equal(trade?.direction, 'long');
});

test('event kind mapping separates live and practice events', () => {
  assert.deepEqual(getCascadeEventKinds('mainnet'), { market: 982, trade: 983 });
  assert.deepEqual(getCascadeEventKinds('signet'), { market: 980, trade: 981 });
});

test('parseMarketEvent accepts practice market kind only in practice mode', () => {
  const event = {
    id: 'practice-market',
    kind: CASCADE_SIGNET_MARKET_KIND,
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    content: '',
    sig: '0'.repeat(128),
    tags: [['d', 'practice-market']]
  };

  assert.equal(parseMarketEvent(event), null);
  assert.equal(parseMarketEvent(event, 'signet')?.slug, 'practice-market');
});

test('parseTradeEvent accepts practice trade kind only in practice mode', () => {
  const event = {
    id: 'practice-trade',
    kind: CASCADE_SIGNET_TRADE_KIND,
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    content: '',
    sig: '0'.repeat(128),
    tags: [
      ['e', 'market-1'],
      ['direction', 'long'],
      ['type', 'buy'],
      ['amount', '2500'],
      ['price', '610000'],
      ['unit', 'usd']
    ]
  };

  assert.equal(parseTradeEvent(event), null);
  assert.equal(parseTradeEvent(event, 'signet')?.marketId, 'market-1');
});

test('parseTradeEvent rejects yes/no aliases', () => {
  const trade = parseTradeEvent({
    id: 'trade-yes',
    kind: CASCADE_TRADE_KIND,
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    content: '',
    sig: '0'.repeat(128),
    tags: [
      ['e', 'market-1'],
      ['direction', 'yes'],
      ['type', 'buy'],
      ['amount', '2500'],
      ['price', '610000'],
      ['unit', 'usd']
    ]
  });

  assert.equal(trade, null);
});

test('yesPricePpmFromTrade normalizes short-side trade prices back to yes probability', () => {
  assert.equal(
    yesPricePpmFromTrade({
      direction: 'short',
      pricePpm: 310_000
    }),
    690_000
  );
});

test('parsePositionEvent accepts long and short directions', () => {
  const position = parsePositionEvent({
    id: 'position-long',
    kind: CASCADE_POSITION_KIND,
    pubkey: 'e'.repeat(64),
    created_at: 1_700_000_100,
    content: JSON.stringify({
      marketId: 'market-1',
      marketTitle: 'Long Position Market',
      direction: 'short',
      quantity: 3,
      costBasis: 4200,
      entryPrice: 0.42,
      timestamp: 1_700_000_100_000
    }),
    sig: '1'.repeat(128),
    tags: [['d', 'cascade:position:market-1:short']]
  });

  assert.equal(position?.direction, 'short');
});

test('parsePositionEvent rejects yes/no aliases', () => {
  const position = parsePositionEvent({
    id: 'position-yes',
    kind: CASCADE_POSITION_KIND,
    pubkey: 'd'.repeat(64),
    created_at: 1_700_000_100,
    content: JSON.stringify({
      marketId: 'market-1',
      marketTitle: 'Legacy Position Market',
      direction: 'yes',
      quantity: 3,
      costBasis: 4200,
      entryPrice: 0.42,
      timestamp: 1_700_000_100_000
    }),
    sig: '2'.repeat(128),
    tags: [['d', 'cascade:position:market-1:yes']]
  });

  assert.equal(position, null);
});

test('buildThreadReplyTags scopes replies to the market root and thread parent', () => {
  assert.deepEqual(buildThreadReplyTags('market-982', 'thread-1111'), [
    ['E', 'market-982', '', 'root'],
    ['K', '982'],
    ['e', 'market-982', '', 'root'],
    ['k', '982'],
    ['e', 'thread-1111', '', 'reply'],
    ['k', '1111']
  ]);
  assert.deepEqual(buildThreadReplyTags('market-980', 'thread-1111', 'signet').slice(0, 4), [
    ['E', 'market-980', '', 'root'],
    ['K', '980'],
    ['e', 'market-980', '', 'root'],
    ['k', '980']
  ]);
});

test('buildDiscussionThreads sorts threads by last activity and annotates nested activity', () => {
  const marketId = 'market-1';
  const records: DiscussionRecord[] = [
    makeDiscussionRecord({
      id: 'thread-older-active',
      marketId,
      rootId: marketId,
      replyTo: marketId,
      createdAt: 1_700_000_000,
      subject: 'Older thread'
    }),
    makeDiscussionRecord({
      id: 'thread-newer-idle',
      marketId,
      rootId: marketId,
      replyTo: marketId,
      createdAt: 1_700_000_100,
      subject: 'Newer idle thread'
    }),
    makeDiscussionRecord({
      id: 'reply-1',
      marketId,
      rootId: marketId,
      replyTo: 'thread-older-active',
      createdAt: 1_700_000_200
    }),
    makeDiscussionRecord({
      id: 'reply-2',
      marketId,
      rootId: marketId,
      replyTo: 'reply-1',
      createdAt: 1_700_000_300
    })
  ];

  const threads = buildDiscussionThreads(records, marketId);

  assert.deepEqual(
    threads.map((thread) => thread.post.id),
    ['thread-older-active', 'thread-newer-idle']
  );
  assert.equal(threads[0]?.replyCount, 2);
  assert.equal(threads[0]?.lastActivityAt, 1_700_000_300);
  assert.equal(threads[0]?.replies[0]?.lastActivityAt, 1_700_000_300);
  assert.equal(threads[0]?.replies[0]?.replies[0]?.lastActivityAt, 1_700_000_300);
  assert.equal(threads[1]?.lastActivityAt, 1_700_000_100);
});

function makeDiscussionRecord({
  id,
  marketId,
  rootId,
  replyTo,
  createdAt,
  subject,
  content = ''
}: {
  id: string;
  marketId: string;
  rootId: string;
  replyTo?: string;
  createdAt: number;
  subject?: string;
  content?: string;
}): DiscussionRecord {
  return {
    id,
    pubkey: 'a'.repeat(64),
    marketId,
    rootId,
    replyTo,
    subject,
    content,
    createdAt,
    rawEvent: {
      id,
      kind: CASCADE_DISCUSSION_KIND,
      pubkey: 'a'.repeat(64),
      created_at: createdAt,
      content,
      sig: 'b'.repeat(128),
      tags: []
    }
  };
}
