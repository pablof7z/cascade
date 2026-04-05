/**
 * Nostr Store — Svelte-compatible store following testnet store pattern
 * 
 * Provides reactive state for Nostr connection (pubkey, isReady) and
 * connection management (reconnect, disconnect).
 * 
 * Initialize with relay URLs based on testnet/mainnet mode.
 */

import { initNostrService, getPubkey, isReady as serviceIsReady } from '../../services/nostrService';
import { clearCache } from '../../bookmarkStore';
import { isTestnet } from './testnet';

const KEYS_STORAGE_KEY = 'cascade-nostr-keys'

// Relay URLs per network
const TESTNET_RELAYS = ['wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']
const MAINNET_RELAYS = ['wss://nostr.wine', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']

// Module-level state
let pubkeyValue: string | null = null;
let readyValue = false;

// Subscriber management
type Subscriber = (value: { pubkey: string | null; isReady: boolean }) => void;
const subscribers = new Set<Subscriber>();

function getState() {
  return { pubkey: pubkeyValue, isReady: readyValue };
}

function notifySubscribers() {
  const state = getState();
  subscribers.forEach(cb => cb(state));
}

// Initialize the Nostr service
async function initService(testnet: boolean): Promise<void> {
  readyValue = false;
  const relayUrls = testnet ? TESTNET_RELAYS : MAINNET_RELAYS;
  await initNostrService(relayUrls);
  pubkeyValue = getPubkey();
  readyValue = serviceIsReady();
  notifySubscribers();
}

/**
 * Initialize the Nostr store.
 * Call this once at app startup.
 */
export async function initNostrStore(): Promise<void> {
  const testnet = isTestnet.get();
  await initService(testnet);
}

// Store with subscribe pattern (compatible with Svelte $effect)
export const nostrStore = {
  subscribe: (callback: Subscriber) => {
    subscribers.add(callback);
    callback(getState()); // Call immediately with current state
    return () => {
      subscribers.delete(callback);
    };
  },
  get: () => getState(),
};

/**
 * Reconnect to Nostr relays.
 * Uses current testnet/mainnet setting.
 */
export async function reconnect(): Promise<void> {
  const testnet = isTestnet.get();
  await initService(testnet);
}

/**
 * Disconnect from Nostr.
 * Clears stored keys and resets state.
 */
export function disconnect(): void {
  // Remove stored keys from localStorage
  localStorage.removeItem(KEYS_STORAGE_KEY);
  // Clear bookmark cache to prevent cross-user data leakage
  clearCache();
  // Reset state
  pubkeyValue = null;
  readyValue = false;
  notifySubscribers();
}

/**
 * Get current pubkey (one-time read, not reactive).
 */
export function getCurrentPubkey(): string | null {
  return pubkeyValue;
}

/**
 * Get current ready state (one-time read, not reactive).
 */
export function isConnected(): boolean {
  return readyValue;
}
