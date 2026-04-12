import type { NDKEvent } from '@nostr-dev-kit/ndk';

export type MarketSlugResult = { slug: string; pubkeyPrefix?: string };

/**
 * Format a market event's d-tag and pubkey into URL-safe slugAndPrefix format
 * Format: {slug}--{pubkeyPrefix12chars}
 * Example: 'my-question--a1b2c3d4e5f6'
 */
export function formatMarketSlug(event: NDKEvent): string {
  const slug = event.tagValue('d') || '';
  const pubkeyPrefix = event.pubkey.slice(0, 12);
  return `${slug}--${pubkeyPrefix}`;
}

/**
 * Parse a slugAndPrefix URL parameter into its components
 * Handles edge case of old slug-only URLs for backwards compatibility
 */
export function parseMarketSlug(slugAndPrefix: string): MarketSlugResult {
  const parts = slugAndPrefix.split('--');
  if (parts.length === 2 && parts[1].length === 12) {
    return { slug: parts[0], pubkeyPrefix: parts[1] };
  }
  // Backwards compatibility: treat entire string as slug
  return { slug: slugAndPrefix };
}
