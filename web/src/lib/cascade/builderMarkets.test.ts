import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeCreatorMarkets,
  prunePendingCreatorMarkets,
  type AuthoredCreatorMarket,
  type PendingCreatorMarket
} from './builderMarkets.ts';

test('mergeCreatorMarkets marks local pending markets as pending and keeps other authored markets public', () => {
  const authored: AuthoredCreatorMarket[] = [
    {
      eventId: 'public-event',
      slug: 'public-market',
      title: 'Public Market',
      createdAt: 200
    },
    {
      eventId: 'pending-event',
      slug: 'pending-market',
      title: 'Pending Market',
      createdAt: 100
    }
  ];
  const pending: PendingCreatorMarket[] = [
    {
      eventId: 'pending-event',
      pubkey: 'creator',
      slug: 'pending-market',
      title: 'Pending Market',
      createdAt: 150
    },
    {
      eventId: 'draft-only',
      pubkey: 'creator',
      slug: 'draft-market',
      title: 'Draft Market',
      createdAt: 300
    }
  ];

  assert.deepEqual(mergeCreatorMarkets(authored, pending), [
    {
      event_id: 'draft-only',
      slug: 'draft-market',
      title: 'Draft Market',
      visibility: 'pending',
      created_at: 300
    },
    {
      event_id: 'public-event',
      slug: 'public-market',
      title: 'Public Market',
      visibility: 'public',
      created_at: 200
    },
    {
      event_id: 'pending-event',
      slug: 'pending-market',
      title: 'Pending Market',
      visibility: 'pending',
      created_at: 150
    }
  ]);
});

test('prunePendingCreatorMarkets removes entries that are now public', () => {
  const pending: PendingCreatorMarket[] = [
    {
      eventId: 'still-pending',
      pubkey: 'creator',
      slug: 'still-pending',
      title: 'Still Pending',
      createdAt: 100
    },
    {
      eventId: 'now-public',
      pubkey: 'creator',
      slug: 'now-public',
      title: 'Now Public',
      createdAt: 200
    }
  ];

  assert.deepEqual(prunePendingCreatorMarkets(pending, new Set(['now-public'])), {
    remaining: [
      {
        eventId: 'still-pending',
        pubkey: 'creator',
        slug: 'still-pending',
        title: 'Still Pending',
        createdAt: 100
      }
    ],
    removed: ['now-public']
  });
});
