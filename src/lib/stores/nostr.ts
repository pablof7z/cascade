/**
 * Nostr Store — Svelte-compatible store
 * 
 * @deprecated Use '$lib/stores/nostr.svelte' instead
 * Re-exports from the new Svelte 5 store for backward compatibility
 */

export {
  initNostrStore,
  reconnect,
  disconnect,
  getCurrentPubkey,
  isConnected,
  nostrStore,
} from './nostr.svelte'
