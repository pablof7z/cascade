import { browser } from '$app/environment';
import { NDKBlossomList, NDKInterestList, NDKRelayStatus, normalizeRelayUrl } from '@nostr-dev-kit/ndk';
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
    // Pass a 10s timeout so pool.connect() doesn't hang forever when a relay
    // is unreachable. Relays continue connecting in the background after the
    // timeout; per-relay publish timeouts handle the rest.
    connectPromise = ndk.connect(10_000).then(() => undefined).catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

/**
 * Resolves when at least one relay from `relayUrls` reaches CONNECTED status,
 * or after `timeoutMs` milliseconds — whichever comes first.
 *
 * Use this before publishing to guard against the case where the cached
 * `ensureClientNdk()` promise resolved on a prior page load but relays have
 * since disconnected.
 */
export function waitForAnyRelayConnected(relayUrls: string[], timeoutMs: number): Promise<void> {
  if (!browser) return Promise.resolve();

  const normalized = relayUrls.map((url) => {
    try {
      return normalizeRelayUrl(url);
    } catch {
      return url;
    }
  });

  const isAnyConnected = () =>
    normalized.some((url) => ndk.pool.relays.get(url)?.status === NDKRelayStatus.CONNECTED);

  if (isAnyConnected()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);

    const onRelayConnect = () => {
      if (isAnyConnected()) {
        clearTimeout(timer);
        ndk.pool.off('relay:connect', onRelayConnect);
        resolve();
      }
    };

    ndk.pool.on('relay:connect', onRelayConnect);
  });
}
