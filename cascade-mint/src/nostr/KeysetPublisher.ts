/**
 * KeysetPublisher - Publish Keysets to Nostr
 * Phase 1 - Foundation
 * 
 * Publishes mint keysets as kind 30001 events
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/curves/abstract/utils';
import { NOSTR_RELAYS, NOSTR_PUBKEY } from '../config.js';
import type { Keyset, KeysetEvent } from '../types/index.js';

/**
 * Publish a keyset to Nostr as kind 30001 event
 */
export async function publishKeyset(keyset: Keyset): Promise<string> {
  const event = createKeysetEvent(keyset);
  
  // Sign the event (in production, use NIP-46 delegation)
  const signedEvent = await signEvent(event);
  
  // Publish to relays
  const eventId = await publishToRelays(signedEvent);
  
  return eventId;
}

/**
 * Create a kind 30001 keyset event
 */
function createKeysetEvent(keyset: Keyset): Omit<KeysetEvent, 'sig'> {
  return {
    id: '', // Will be computed
    pubkey: NOSTR_PUBKEY,
    createdAt: Math.floor(Date.now() / 1000),
    kind: 30001,
    tags: [
      ['market_id', keyset.marketId],
      ['keyset_id', keyset.id],
      ['long', keyset.longPubkey],
      ['short', keyset.shortPubkey],
    ],
    content: JSON.stringify({
      marketId: keyset.marketId,
      keysetId: keyset.id,
      longPubkey: keyset.longPubkey,
      shortPubkey: keyset.shortPubkey,
      reserveSat: keyset.reserveSat,
      createdAt: keyset.createdAt,
    }),
  };
}

/**
 * Sign an event (simplified for Phase 1)
 * In production, use proper Nostr signing via NIP-46
 */
async function signEvent(event: Omit<KeysetEvent, 'sig'>): Promise<KeysetEvent> {
  // Compute event ID
  const id = computeEventId(event);
  
  // For Phase 1, we use a placeholder signature
  // In production, sign with private key or use NIP-46 delegation
  const sig = await computeSignature(id);
  
  return {
    ...event,
    id,
    sig,
  };
}

/**
 * Compute Nostr event ID
 */
function computeEventId(event: Omit<KeysetEvent, 'sig'>): string {
  // Nostr event ID is SHA256 of serialized event
  const serialized = [
    0, // Always 0
    event.pubkey,
    event.createdAt,
    event.kind,
    event.tags,
    event.content,
  ].map((v) => JSON.stringify(v)).join('');

  // Use Web Crypto API for SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);
  const hash = sha256(data);
  
  return bytesToHex(hash);
}

/**
 * Compute event signature
 */
async function computeSignature(eventId: string): Promise<string> {
  // For Phase 1, use placeholder signature
  // In production, sign with private key using BIP-340
  return `sig-${eventId.slice(0, 16)}`;
}

/**
 * Publish signed event to Nostr relays
 */
async function publishToRelays(event: KeysetEvent): Promise<string> {
  const successRelays: string[] = [];

  // Try all relays
  const results = await Promise.allSettled(
    NOSTR_RELAYS.map(async (relay) => {
      await publishToRelay(relay, event);
      return relay;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successRelays.push(result.value);
    }
  }

  if (successRelays.length === 0) {
    throw new Error('Failed to publish to any relay');
  }

  return event.id;
}

/**
 * Publish event to single relay
 */
async function publishToRelay(relayUrl: string, event: KeysetEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Relay timeout'));
    }, 5000);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['EVENT', event]));
      
      ws.addEventListener('message', (msg: MessageEvent) => {
        try {
          const response = JSON.parse(msg.data as string);
          if (response[0] === 'OK') {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } catch {
          clearTimeout(timeout);
          ws.close();
          resolve(); // Still resolve on OK
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error'));
      });

      // Close after short delay
      setTimeout(() => {
        ws.close();
        clearTimeout(timeout);
        resolve();
      }, 1000);
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket error'));
    });
  });
}

/**
 * Fetch keyset events from Nostr
 */
export async function fetchKeysetFromNostr(marketId: string): Promise<KeysetEvent | null> {
  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const keyset = await fetchKeysetFromRelay(relayUrl, marketId);
      if (keyset) return keyset;
    } catch {
      // Try next relay
    }
  }
  return null;
}

/**
 * Fetch keyset from single relay
 */
async function fetchKeysetFromRelay(relayUrl: string, marketId: string): Promise<KeysetEvent | null> {
  const ws = new WebSocket(relayUrl);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 5000);

    const subscriptionId = `keyset-${Date.now()}`;

    ws.addEventListener('open', () => {
      const filter = {
        kinds: [30001],
        '#market_id': [marketId],
      };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const [type, subId, data] = JSON.parse(event.data as string);

          if (type === 'EVENT' && subId === subscriptionId) {
            ws.close();
            clearTimeout(timeout);
            resolve(parseKeysetEvent(data));
          } else if (type === 'EOSE') {
            ws.close();
            clearTimeout(timeout);
            resolve(null);
          }
        } catch {
          clearTimeout(timeout);
          resolve(null);
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

/**
 * Parse a kind 30001 keyset event
 */
function parseKeysetEvent(event: {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}): KeysetEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    kind: 30001,
    tags: event.tags,
    content: event.content,
    sig: event.sig,
  };
}

// Export singleton-like functions
export const keysetPublisher = {
  publishKeyset,
  fetchKeysetFromNostr,
};
