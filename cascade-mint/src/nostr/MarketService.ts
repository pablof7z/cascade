/**
 * MarketService - Nostr Market Discovery
 * Phase 1 - Foundation
 * 
 * Fetches kind 30000 market events from relays for keyset derivation
 */

import { NOSTR_RELAYS } from '../config.js';
import type { MarketEvent } from '../types/index.js';

// Cache for relay health status
const relayHealth: Map<string, boolean> = new Map();

/**
 * Fetch kind 30000 events from relays
 */
export async function fetchMarketsFromRelays(): Promise<MarketEvent[]> {
  const markets: MarketEvent[] = [];
  const seenIds = new Set<string>();

  // Try each relay until we get enough results
  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const relayMarkets = await fetchMarketsFromRelay(relayUrl);
      
      for (const market of relayMarkets) {
        if (!seenIds.has(market.id)) {
          seenIds.add(market.id);
          markets.push(market);
        }
      }

      // Stop if we have enough markets
      if (markets.length >= 50) break;
    } catch (error) {
      console.error(`Failed to fetch from ${relayUrl}:`, error);
    }
  }

  return markets;
}

/**
 * Fetch markets from a single relay
 */
async function fetchMarketsFromRelay(relayUrl: string): Promise<MarketEvent[]> {
  // Simple WebSocket connection for Nostr
  const ws = new WebSocket(relayUrl);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Relay connection timeout'));
    }, 5000);

    const markets: MarketEvent[] = [];
    const unsubscribe = () => {
      ws.send(JSON.stringify(['CLOSE', subscriptionId]));
    };

    const subscriptionId = `markets-${Date.now()}`;

    ws.addEventListener('open', () => {
      // Send subscription request for kind 30000
      const filter = {
        kinds: [30000],
        limit: 50,
      };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      // Setup message handler
      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const [type, subId, data] = JSON.parse(event.data as string);

          if (type === 'EVENT' && subId === subscriptionId) {
            markets.push(parseMarketEvent(data));
          } else if (type === 'EOSE' && subId === subscriptionId) {
            // End of stored events
            unsubscribe();
            ws.close();
            clearTimeout(timeout);
            resolve(markets);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      // Unsubscribe after 2 seconds
      setTimeout(() => {
        unsubscribe();
        ws.close();
        clearTimeout(timeout);
        resolve(markets);
      }, 2000);
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket error'));
    });
  });
}

/**
 * Parse a kind 30000 market event
 */
function parseMarketEvent(event: {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}): MarketEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    kind: 30000,
    tags: event.tags,
    content: event.content,
    sig: event.sig,
  };
}

/**
 * Check relay health
 */
export async function checkRelayHealth(relayUrl: string): Promise<boolean> {
  if (relayHealth.has(relayUrl)) {
    return relayHealth.get(relayUrl)!;
  }

  try {
    const ws = new WebSocket(relayUrl);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        relayHealth.set(relayUrl, false);
        resolve(false);
      }, 3000);

      ws.addEventListener('open', () => {
        clearTimeout(timeout);
        relayHealth.set(relayUrl, true);
        ws.close();
        resolve(true);
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        relayHealth.set(relayUrl, false);
        resolve(false);
      });
    });
  } catch {
    relayHealth.set(relayUrl, false);
    return false;
  }
}

/**
 * Get healthy relays
 */
export async function getHealthyRelays(): Promise<string[]> {
  const results = await Promise.all(
    NOSTR_RELAYS.map(async (relay) => ({
      relay,
      healthy: await checkRelayHealth(relay),
    }))
  );

  return results.filter(r => r.healthy).map(r => r.relay);
}

/**
 * Fetch a specific market by ID
 */
export async function fetchMarketById(eventId: string): Promise<MarketEvent | null> {
  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const market = await fetchMarketFromRelay(relayUrl, eventId);
      if (market) return market;
    } catch {
      // Try next relay
    }
  }
  return null;
}

/**
 * Fetch a specific market from a relay
 */
async function fetchMarketFromRelay(relayUrl: string, eventId: string): Promise<MarketEvent | null> {
  const ws = new WebSocket(relayUrl);
  const subscriptionId = `market-${Date.now()}`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 5000);

    ws.addEventListener('open', () => {
      const filter = {
        ids: [eventId],
      };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const [type, subId, data] = JSON.parse(event.data as string);

          if (type === 'EVENT' && subId === subscriptionId) {
            ws.close();
            clearTimeout(timeout);
            resolve(parseMarketEvent(data));
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

// Export singleton-like functions
export const marketService = {
  fetchMarketsFromRelays,
  fetchMarketById,
  checkRelayHealth,
  getHealthyRelays,
};
