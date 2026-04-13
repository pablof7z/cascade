import type { NDKUserProfile } from '@nostr-dev-kit/ndk';

const PROFILE_PUBLISH_METADATA_KEYS = new Set([
  'content',
  'created_at',
  'id',
  'kind',
  'profileEvent',
  'pubkey',
  'sig',
  'tags'
]);

export function sanitizeProfileForPublish(
  profile: NDKUserProfile | null | undefined
): NDKUserProfile {
  if (!profile) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
    if (PROFILE_PUBLISH_METADATA_KEYS.has(key)) continue;
    if (value === undefined) continue;

    sanitized[key] = value;
  }

  return sanitized as NDKUserProfile;
}
