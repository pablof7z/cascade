/**
 * Root layout — initializes the Nostr service once at app startup.
 */

import { initNostrStore } from '$lib/stores/nostr';

export const load = async () => {
  try {
    await initNostrStore();
    return { nostrReady: true };
  } catch (error) {
    console.error('Failed to initialize Nostr service:', error);
    return { nostrReady: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};