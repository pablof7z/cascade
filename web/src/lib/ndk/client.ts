import { browser } from '$app/environment';
import { NDKBlossomList, NDKInterestList } from '@nostr-dev-kit/ndk';
import { createNDK } from '@nostr-dev-kit/svelte';
import { LocalStorage } from '@nostr-dev-kit/sessions';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';

export const ndk = createNDK({
  explicitRelayUrls: DEFAULT_RELAYS,
  clientName: APP_NAME,
  enableOutboxModel: false,
  session: {
    storage: new LocalStorage('ndk-sveltekit-template:sessions'),
    autoSave: true,
    fetches: {
      follows: true,
      mutes: true,
      relayList: true,
      monitor: [NDKInterestList, NDKBlossomList]
    }
  }
});

let connectPromise: Promise<void> | null = null;

export function ensureClientNdk(): Promise<void> {
  if (!browser) return Promise.resolve();
  if (!connectPromise) {
    connectPromise = ndk.connect().then(() => undefined).catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}
