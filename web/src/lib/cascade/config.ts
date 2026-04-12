import { env } from '$env/dynamic/public';

const DEFAULT_MAINNET_MINT = 'https://mint.f7z.io';
const LEGACY_MAINNET_MINT = 'https://mint.cascade.market';

export type CascadeEdition = 'mainnet' | 'signet';

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

export function storageKey(base: string): string {
  return `${base}:${getCascadeEdition()}`;
}
