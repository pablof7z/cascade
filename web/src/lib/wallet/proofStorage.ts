export type ProofWalletEdition = 'signet' | 'mainnet' | string;

export function normalizeProofMintUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function canonicalizeProofWalletUnit(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return trimmed;

  if (/^usd$/i.test(trimmed)) {
    return 'usd';
  }

  if (/^long_/i.test(trimmed)) {
    return `long_${trimmed.slice('long_'.length).toLowerCase()}`;
  }

  if (/^short_/i.test(trimmed)) {
    return `short_${trimmed.slice('short_'.length).toLowerCase()}`;
  }

  return trimmed;
}

function legacyProofWalletStorageKey(mintUrl: string, unit: string): string {
  return `cascade:proof-wallet:${normalizeProofMintUrl(mintUrl)}:${unit}`;
}

export function proofWalletStorageKey(
  edition: ProofWalletEdition,
  mintUrl: string,
  unit: string
): string {
  return `cascade:${edition}:proof-wallet:${normalizeProofMintUrl(mintUrl)}:${canonicalizeProofWalletUnit(unit)}`;
}

export function proofWalletStoragePrefix(edition: ProofWalletEdition, mintUrl: string): string {
  return `cascade:${edition}:proof-wallet:${normalizeProofMintUrl(mintUrl)}:`;
}

export function proofWalletLegacyPrefix(mintUrl: string): string {
  return `cascade:proof-wallet:${normalizeProofMintUrl(mintUrl)}:`;
}

export function proofWalletLegacyStorageKeys(mintUrl: string, unit: string): string[] {
  const normalizedMintUrl = normalizeProofMintUrl(mintUrl);
  const canonicalUnit = canonicalizeProofWalletUnit(unit);
  const keys = [legacyProofWalletStorageKey(normalizedMintUrl, canonicalUnit)];
  const trimmedUnit = unit.trim();

  if (/^usd$/i.test(trimmedUnit)) {
    keys.push(legacyProofWalletStorageKey(normalizedMintUrl, 'USD'));
  } else if (/^long_/i.test(trimmedUnit)) {
    keys.push(legacyProofWalletStorageKey(normalizedMintUrl, `LONG_${trimmedUnit.slice('long_'.length)}`));
  } else if (/^short_/i.test(trimmedUnit)) {
    keys.push(
      legacyProofWalletStorageKey(normalizedMintUrl, `SHORT_${trimmedUnit.slice('short_'.length)}`)
    );
  }

  return Array.from(new Set(keys));
}

export function proofWalletStorageCandidates(
  edition: ProofWalletEdition,
  mintUrl: string,
  unit: string
): string[] {
  return [proofWalletStorageKey(edition, mintUrl, unit), ...proofWalletLegacyStorageKeys(mintUrl, unit)];
}
