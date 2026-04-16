import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';

const DEFAULT_MAINNET_MINT = 'https://mint.f7z.io';
const DEFAULT_SIGNET_MINT = 'https://signet-mint.cascade.f7z.io';
const LEGACY_MAINNET_MINT = 'https://mint.cascade.market';
export const CASCADE_EDITION_COOKIE = 'cascade_edition';

export type CascadeEdition = 'mainnet' | 'signet';

export type CascadeFundingRailAvailability = {
  available: boolean;
  reason?: string | null;
};

export type CascadeClientRuntime = {
  edition: CascadeEdition;
  network: CascadeEdition;
  mintUrl: string;
  proofCustody: 'browser-local';
  funding: {
    lightning: CascadeFundingRailAvailability;
    stripe: CascadeFundingRailAvailability;
  };
};

export function parseCascadeEdition(value: unknown): CascadeEdition | null {
  if (typeof value !== 'string') return null;
  const raw = value.toLowerCase().trim();
  if (raw === 'signet' || raw === 'paper' || raw === 'practice') return 'signet';
  if (raw === 'mainnet' || raw === 'live') return 'mainnet';
  return null;
}

function legacyEnvEdition(): CascadeEdition {
  return parseCascadeEdition(env.PUBLIC_CASCADE_EDITION) ?? 'mainnet';
}

function browserEditionCookie(): CascadeEdition | null {
  if (!browser) return null;
  const cookies = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);
  const prefix = `${CASCADE_EDITION_COOKIE}=`;
  const value = cookies
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
  return parseCascadeEdition(value ? decodeURIComponent(value) : null);
}

export function getCascadeEdition(edition?: CascadeEdition | string | null): CascadeEdition {
  return parseCascadeEdition(edition) ?? browserEditionCookie() ?? legacyEnvEdition();
}

export function isPaperEdition(edition?: CascadeEdition | string | null): boolean {
  return getCascadeEdition(edition) === 'signet';
}

export function normalizeMintUrl(url: string): string {
  return url === LEGACY_MAINNET_MINT ? DEFAULT_MAINNET_MINT : url;
}

function legacyMintUrlForEdition(edition: CascadeEdition): string | undefined {
  return legacyEnvEdition() === edition ? env.PUBLIC_CASCADE_MINT_URL : undefined;
}

function legacyApiUrlForEdition(edition: CascadeEdition): string | undefined {
  return legacyEnvEdition() === edition ? env.PUBLIC_CASCADE_API_URL : undefined;
}

export function getMintUrl(edition: CascadeEdition | string | null = getCascadeEdition()): string {
  const selected = getCascadeEdition(edition);
  return normalizeMintUrl(
    selected === 'signet'
      ? env.PUBLIC_CASCADE_SIGNET_MINT_URL ||
          legacyMintUrlForEdition('signet') ||
          DEFAULT_SIGNET_MINT
      : env.PUBLIC_CASCADE_MAINNET_MINT_URL ||
          legacyMintUrlForEdition('mainnet') ||
          DEFAULT_MAINNET_MINT
  );
}

export function getProductApiUrl(
  edition: CascadeEdition | string | null = getCascadeEdition()
): string {
  const selected = getCascadeEdition(edition);
  return normalizeMintUrl(
    selected === 'signet'
      ? env.PUBLIC_CASCADE_SIGNET_API_URL ||
          legacyApiUrlForEdition('signet') ||
          getMintUrl(selected)
      : env.PUBLIC_CASCADE_MAINNET_API_URL ||
          legacyApiUrlForEdition('mainnet') ||
          getMintUrl(selected)
  );
}

export function getCascadeEditionLabel(
  edition: CascadeEdition | string | null = getCascadeEdition()
): string {
  return getCascadeEdition(edition) === 'signet' ? 'Practice' : 'Live';
}

export function getCascadeEditionDescription(
  edition: CascadeEdition | string | null = getCascadeEdition()
): string {
  return getCascadeEdition(edition) === 'signet'
    ? 'Practice uses paper funds and separate browser-local proofs.'
    : 'Live uses real funds and separate browser-local proofs.';
}

export function getAlternateEditionUrl(
  edition: CascadeEdition | string | null = getCascadeEdition()
): string | null {
  const selected = getCascadeEdition(edition);
  const alternate = selected === 'signet' ? env.PUBLIC_CASCADE_MAINNET_URL : env.PUBLIC_CASCADE_SIGNET_URL;

  if (!alternate) return null;
  const normalized = normalizeMintUrl(alternate);
  const currentBase = normalizeMintUrl(env.PUBLIC_CASCADE_SITE_URL || '');
  if (currentBase && currentBase === normalized) return null;
  return normalized;
}

export function isStripeFundingEnabled(
  edition: CascadeEdition | string | null = getCascadeEdition()
): boolean {
  const selected = getCascadeEdition(edition);
  const editionSpecific =
    selected === 'signet'
      ? env.PUBLIC_CASCADE_SIGNET_ENABLE_STRIPE_FUNDING ||
        env.PUBLIC_CASCADE_SIGNET_ENABLE_STRIPE_TOPUPS
      : env.PUBLIC_CASCADE_MAINNET_ENABLE_STRIPE_FUNDING ||
        env.PUBLIC_CASCADE_MAINNET_ENABLE_STRIPE_TOPUPS;
  const fallback =
    env.PUBLIC_CASCADE_ENABLE_STRIPE_FUNDING || env.PUBLIC_CASCADE_ENABLE_STRIPE_TOPUPS;

  return (editionSpecific ?? fallback) === 'true';
}

export function getCascadeClientRuntime(
  selectedEdition: CascadeEdition | string | null = getCascadeEdition()
): CascadeClientRuntime {
  const edition = getCascadeEdition(selectedEdition);
  return {
    edition,
    network: edition,
    mintUrl: getProductApiUrl(edition),
    proofCustody: 'browser-local',
    funding: {
      lightning: { available: true },
      stripe: isStripeFundingEnabled(edition)
        ? { available: true }
        : { available: false, reason: 'stripe_fundings_unavailable' }
    }
  };
}

export function storageKey(base: string, edition?: CascadeEdition | string | null): string {
  return `${base}:${getCascadeEdition(edition)}`;
}
