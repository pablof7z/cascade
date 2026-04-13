import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLocalPositionTradeFromPayload,
  listLocalPositionBook
} from './localPositionBook.ts';

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return storage.has(key) ? storage.get(key)! : null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
      clear() {
        storage.clear();
      }
    }
  });

  return storage;
}

function tradePayload(direction: string) {
  return {
    market: {
      event_id: 'market-1',
      slug: 'market-1',
      title: 'Market One',
      description: '',
      creator_pubkey: 'c'.repeat(64),
      visibility: 'public',
      created_at: 1_700_000_000,
      first_trade_at: 1_700_000_000,
      price_yes_ppm: 600_000,
      price_no_ppm: 400_000,
      volume_minor: 2_500,
      trade_count: 1,
      reserve_minor: 2_500,
      raw_event: {}
    },
    trade: {
      id: `trade-${direction}`,
      tags: [
        ['type', 'buy'],
        ['direction', direction],
        ['quantity', '2'],
        ['amount', '2500']
      ]
    }
  } satisfies Parameters<typeof applyLocalPositionTradeFromPayload>[1];
}

test('applyLocalPositionTradeFromPayload stores long and short sides', () => {
  installLocalStorage();

  const applied = applyLocalPositionTradeFromPayload(
    'https://mint.example',
    tradePayload('long'),
    'buy',
    'long'
  );

  assert.equal(applied, true);
  assert.equal(listLocalPositionBook('https://mint.example')[0]?.side, 'long');
});

test('applyLocalPositionTradeFromPayload rejects yes/no aliases', () => {
  installLocalStorage();

  const applied = applyLocalPositionTradeFromPayload(
    'https://mint.example',
    tradePayload('yes'),
    'buy',
    'long'
  );

  assert.equal(applied, false);
  assert.deepEqual(listLocalPositionBook('https://mint.example'), []);
});
