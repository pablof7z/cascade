/**
 * Market Slug Utilities
 * 
 * Helper functions for formatting and parsing market URLs.
 * Format: {slug}--{pubkeyPrefix12chars}
 * Example: 'my-question--a1b2c3d4e5f6'
 */

import type { Market } from '../market';

/**
 * Format a market's slug and pubkey into the URL-safe slugAndPrefix format.
 * Format: {slug}--{pubkeyPrefix12chars}
 * Example: 'my-question--a1b2c3d4e5f6'
 */
export function formatMarketSlug(market: Market): string {
  const pubkeyPrefix = market.creatorPubkey.slice(0, 12);
  return `${market.slug}--${pubkeyPrefix}`;
}

/**
 * Parse a slugAndPrefix URL parameter into its components.
 * Handles edge case of old slug-only URLs for backwards compatibility.
 */
export function parseMarketSlug(
  slugAndPrefix: string,
): { slug: string; pubkeyPrefix?: string } {
  const parts = slugAndPrefix.split('--');
  if (parts.length === 2 && parts[1].length === 12) {
    return { slug: parts[0], pubkeyPrefix: parts[1] };
  }
  // Backwards compatibility: treat entire string as slug
  return { slug: slugAndPrefix };
}