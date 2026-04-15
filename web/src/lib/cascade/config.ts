import { env } from '$env/dynamic/public';

const DEFAULT_MAINNET_MINT = 'https://mint.f7z.io';
const LEGACY_MAINNET_MINT = 'https://mint.cascade.market';

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

export function getCascadeEdition(): CascadeEdition {
  const raw = env.PUBLIC_CASCADE_EDITION?.toLowerCase();
  return raw === 'signet' || raw === 'paper' ? 'signet' : 'mainnet';
}

export function isPaperEdition(): boolean {
  return getCascadeEdition() === 'signet';
}

export function normalizeMintUrl(url: string): string {
  return url === LEGACY_MAINNET_MINT ? DEFAULT_MAINNET_MINT : url;
}

export function getMintUrl(): string {
  return normalizeMintUrl(env.PUBLIC_CASCADE_MINT_URL || DEFAULT_MAINNET_MINT);
}

export function getProductApiUrl(): string {
  return normalizeMintUrl(env.PUBLIC_CASCADE_API_URL || getMintUrl());
}

export function getCascadeEditionLabel(): string {
  return getCascadeEdition() === 'signet' ? 'Signet paper trading' : 'Mainnet live trading';
}

export function getCascadeEditionDescription(): string {
  return getCascadeEdition() === 'signet'
    ? 'This edition uses paper funds. Browser-local proofs stay separate from mainnet.'
    : 'This edition uses live funds. Browser-local proofs stay separate from signet.';
}

export function getAlternateEditionUrl(): string | null {
  const edition = getCascadeEdition();
  const alternate =
    edition === 'signet' ? env.PUBLIC_CASCADE_MAINNET_URL : env.PUBLIC_CASCADE_SIGNET_URL;

  if (!alternate) return null;
  const normalized = normalizeMintUrl(alternate);
  const currentBase = normalizeMintUrl(env.PUBLIC_CASCADE_SITE_URL || '');
  if (currentBase && currentBase === normalized) return null;
  return normalized;
}

export function isStripeFundingEnabled(): boolean {
  return (
    env.PUBLIC_CASCADE_ENABLE_STRIPE_FUNDING === 'true' ||
    env.PUBLIC_CASCADE_ENABLE_STRIPE_TOPUPS === 'true'
  );
}

export function getCascadeClientRuntime(): CascadeClientRuntime {
  const edition = getCascadeEdition();
  return {
    edition,
    network: edition,
    mintUrl: getProductApiUrl(),
    proofCustody: 'browser-local',
    funding: {
      lightning: { available: true },
      stripe: isStripeFundingEnabled()
        ? { available: true }
        : { available: false, reason: 'stripe_fundings_unavailable' }
    }
  };
}

export function storageKey(base: string): string {
  return `${base}:${getCascadeEdition()}`;
}
