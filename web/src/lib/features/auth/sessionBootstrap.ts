import { browser } from '$app/environment';
import { ndk, ensureClientNdk } from '$lib/ndk/client';

export const AUTH_BOOTSTRAP_ERROR =
  'Authentication is still starting on this device. Try again in a moment.';

export async function requireAuthSessions(): Promise<NonNullable<typeof ndk.$sessions>> {
  if (!browser) {
    throw new Error('Authentication is only available in the browser.');
  }

  if (ndk.$sessions) {
    void ensureClientNdk().catch((error) => {
      console.error('Failed to connect client NDK during auth bootstrap', error);
    });
    return ndk.$sessions;
  }

  await ensureClientNdk();

  if (!ndk.$sessions) {
    throw new Error(AUTH_BOOTSTRAP_ERROR);
  }

  return ndk.$sessions;
}
