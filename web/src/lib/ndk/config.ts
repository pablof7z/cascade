import { env } from '$env/dynamic/public';

export const APP_NAME = 'Cascade';
export const APP_TAGLINE =
  'Markets as Nostr events. Trading activity published by the mint. No oracle, no expiry, no closing bell.';

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://purplepag.es',
  'wss://relay.primal.net'
];

export const DEFAULT_RELAYS = parseRelayList(
  env.PUBLIC_NOSTR_RELAYS,
  FALLBACK_RELAYS
);

function parseRelayList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((relay) => relay.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}
