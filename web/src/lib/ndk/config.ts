import { env } from '$env/dynamic/public';

export const APP_NAME = 'Cascade';
export const APP_TAGLINE =
  'Markets as Nostr events. Trading activity published by the mint. No oracle, no expiry, no closing bell.';

const PUBLIC_DIRECTORY_RELAY = 'wss://purplepag.es';

// purplepag.es only accepts profile event kinds (0, 3, 10002).
// Market and trade events (kinds 980-983) require relays that accept arbitrary kinds.
const FALLBACK_RELAYS = [PUBLIC_DIRECTORY_RELAY, 'wss://relay.damus.io', 'wss://relay.primal.net'];

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
