import type { NDKUser } from '@nostr-dev-kit/ndk';

export function safeUserPubkey(user: Pick<NDKUser, 'pubkey'> | null | undefined): string {
  if (!user) return '';

  try {
    return user.pubkey || '';
  } catch {
    return '';
  }
}

export function safeUserIdentifier(
  user: Pick<NDKUser, 'npub' | 'pubkey'> | null | undefined,
  fallback = ''
): string {
  if (!user) return fallback;

  try {
    return user.npub || fallback;
  } catch {
    return safeUserPubkey(user) || fallback;
  }
}
