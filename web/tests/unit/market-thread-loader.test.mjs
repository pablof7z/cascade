import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

async function loadThreadHelpers() {
  return import(pathToFileURL(path.join(webRoot, 'src/lib/server/market-thread.ts')).href);
}

function makeMarket() {
  return {
    id: 'market-1',
    slug: 'test-market',
    title: 'Test market',
    description: 'A live market',
    body: 'Trading continues indefinitely.',
    pubkey: 'f'.repeat(64),
    createdAt: 1_700_000_000,
    categories: [],
    topics: [],
    latestPricePpm: 500_000,
    rawEvent: {
      id: 'market-1',
      kind: 982,
      pubkey: 'f'.repeat(64),
      created_at: 1_700_000_000,
      content: 'Trading continues indefinitely.',
      sig: '0'.repeat(128),
      tags: []
    }
  };
}

function makeDiscussionRecord(id, overrides = {}) {
  return {
    id,
    pubkey: 'a'.repeat(64),
    marketId: 'market-1',
    rootId: 'market-1',
    replyTo: 'market-1',
    subject: 'Thread subject',
    content: 'Thread content',
    createdAt: 1_700_000_100,
    rawEvent: {
      id,
      kind: 1111,
      pubkey: 'a'.repeat(64),
      created_at: 1_700_000_100,
      content: 'Thread content',
      sig: '1'.repeat(128),
      tags: []
    },
    ...overrides
  };
}

function makeSurfaceData(discussions = []) {
  return {
    market: makeMarket(),
    trades: [],
    discussions,
    relatedMarkets: [],
    profiles: {}
  };
}

test('resolveMarketThread merges a direct relay thread fetch when seeded discussions miss the thread', async () => {
  const { resolveMarketThread } = await loadThreadHelpers();
  const fallbackThread = makeDiscussionRecord('thread-live', {
    subject: 'Fresh thread',
    content: 'Published moments ago.'
  });
  let fallbackCalls = 0;

  const result = await resolveMarketThread(makeSurfaceData([]), 'thread-live', async () => {
    fallbackCalls += 1;
    return [fallbackThread];
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(result.thread?.post.id, 'thread-live');
  assert.deepEqual(result.discussions.map((discussion) => discussion.id), ['thread-live']);
});

test('resolveMarketThread does not refetch when seeded discussions already contain the requested thread', async () => {
  const { resolveMarketThread } = await loadThreadHelpers();
  const existingThread = makeDiscussionRecord('thread-existing');
  let fallbackCalls = 0;

  const result = await resolveMarketThread(makeSurfaceData([existingThread]), 'thread-existing', async () => {
    fallbackCalls += 1;
    return [];
  });

  assert.equal(fallbackCalls, 0);
  assert.equal(result.thread?.post.id, 'thread-existing');
  assert.deepEqual(result.discussions.map((discussion) => discussion.id), ['thread-existing']);
});
