import { browser } from '$app/environment';
import type { ProductProof } from '$lib/cascade/api';

const STORAGE_VERSION = 1;

export type StoredProofWallet = {
  version: number;
  mintUrl: string;
  unit: string;
  proofs: ProductProof[];
  updatedAt: number;
};

function canonicalizeUnit(unit: string): string {
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

function rawStorageKey(mintUrl: string, unit: string): string {
  return `cascade:proof-wallet:${mintUrl}:${unit}`;
}

function storageKey(mintUrl: string, unit: string): string {
  return rawStorageKey(normalizeMintUrl(mintUrl), canonicalizeUnit(unit));
}

function normalizeMintUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function readLocalProofWallet(mintUrl: string, unit: string): StoredProofWallet {
  const normalizedMintUrl = normalizeMintUrl(mintUrl);
  const canonicalUnit = canonicalizeUnit(unit);

  if (!browser) {
    return {
      version: STORAGE_VERSION,
      mintUrl: normalizedMintUrl,
      unit: canonicalUnit,
      proofs: [],
      updatedAt: 0
    };
  }

  const candidateKeys = [
    storageKey(normalizedMintUrl, canonicalUnit),
    ...legacyStorageKeys(normalizedMintUrl, canonicalUnit)
  ];
  const proofsByCommitment = new Map<string, ProductProof>();
  let updatedAt = 0;
  let foundLegacyKey = false;

  for (const key of candidateKeys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const parsed = parseStoredWallet(raw, normalizedMintUrl, canonicalUnit);
    if (!parsed) continue;

    updatedAt = Math.max(updatedAt, parsed.updatedAt);
    for (const proof of parsed.proofs) {
      proofsByCommitment.set(proof.C, proof);
    }

    if (key !== storageKey(normalizedMintUrl, canonicalUnit)) {
      foundLegacyKey = true;
    }
  }

  const next: StoredProofWallet = {
    version: STORAGE_VERSION,
    mintUrl: normalizedMintUrl,
    unit: canonicalUnit,
    proofs: Array.from(proofsByCommitment.values()),
    updatedAt
  };

  if (foundLegacyKey) {
    writeLocalProofWallet(next);
    for (const key of legacyStorageKeys(normalizedMintUrl, canonicalUnit)) {
      window.localStorage.removeItem(key);
    }
  }

  return next;
}

export function writeLocalProofWallet(wallet: StoredProofWallet): void {
  if (!browser) return;
  const normalizedMintUrl = normalizeMintUrl(wallet.mintUrl);
  const canonicalUnit = canonicalizeUnit(wallet.unit);
  window.localStorage.setItem(
    storageKey(normalizedMintUrl, canonicalUnit),
    JSON.stringify({
      ...wallet,
      version: STORAGE_VERSION,
      mintUrl: normalizedMintUrl,
      unit: canonicalUnit,
      updatedAt: Date.now()
    } satisfies StoredProofWallet)
  );
}

export function listLocalProofs(mintUrl: string, unit: string): ProductProof[] {
  return readLocalProofWallet(mintUrl, unit).proofs;
}

export function listLocalProofWallets(mintUrl: string): StoredProofWallet[] {
  if (!browser) return [];

  const normalizedMintUrl = normalizeMintUrl(mintUrl);
  const keyPrefix = `cascade:proof-wallet:${normalizedMintUrl}:`;

  const units = new Set(
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(keyPrefix))
      .map((key) => key.slice(keyPrefix.length))
      .filter(Boolean)
      .map((unit) => canonicalizeUnit(unit))
  );

  return Array.from(units)
    .map((unit) => readLocalProofWallet(normalizedMintUrl, unit))
    .filter((wallet) => wallet.proofs.length > 0);
}

function legacyStorageKeys(mintUrl: string, unit: string): string[] {
  if (unit === 'usd') {
    return [rawStorageKey(mintUrl, 'USD')];
  }

  if (unit.startsWith('long_')) {
    return [rawStorageKey(mintUrl, `LONG_${unit.slice('long_'.length)}`)];
  }

  if (unit.startsWith('short_')) {
    return [rawStorageKey(mintUrl, `SHORT_${unit.slice('short_'.length)}`)];
  }

  return [];
}

function parseStoredWallet(
  raw: string,
  mintUrl: string,
  unit: string
): StoredProofWallet | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProofWallet>;
    const proofs = Array.isArray(parsed.proofs)
      ? parsed.proofs.filter(
          (proof): proof is ProductProof =>
            Boolean(
              proof &&
                typeof proof.id === 'string' &&
                typeof proof.secret === 'string' &&
                typeof proof.C === 'string' &&
                typeof proof.amount === 'number'
            )
        )
      : [];

    return {
      version: STORAGE_VERSION,
      mintUrl: normalizeMintUrl(typeof parsed.mintUrl === 'string' ? parsed.mintUrl : mintUrl),
      unit: canonicalizeUnit(typeof parsed.unit === 'string' ? parsed.unit : unit),
      proofs,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    };
  } catch {
    return null;
  }
}

export function localProofBalance(mintUrl: string, unit: string): number {
  return listLocalProofs(mintUrl, unit).reduce((sum, proof) => sum + proof.amount, 0);
}

export function addLocalProofs(
  mintUrl: string,
  unit: string,
  proofs: ProductProof[]
): StoredProofWallet {
  const current = readLocalProofWallet(mintUrl, unit);
  const byCommitment = new Map(current.proofs.map((proof) => [proof.C, proof]));

  for (const proof of proofs) {
    byCommitment.set(proof.C, proof);
  }

  const next: StoredProofWallet = {
    ...current,
    proofs: Array.from(byCommitment.values()),
    updatedAt: Date.now()
  };
  writeLocalProofWallet(next);
  return next;
}

export function removeLocalProofs(
  mintUrl: string,
  unit: string,
  proofs: ProductProof[]
): StoredProofWallet {
  const current = readLocalProofWallet(mintUrl, unit);
  if (!proofs.length) return current;

  const spentCommitments = new Set(proofs.map((proof) => proof.C));
  const next: StoredProofWallet = {
    ...current,
    proofs: current.proofs.filter((proof) => !spentCommitments.has(proof.C)),
    updatedAt: Date.now()
  };
  writeLocalProofWallet(next);
  return next;
}

export function selectLocalProofsForAmount(
  mintUrl: string,
  unit: string,
  targetAmount: number
): ProductProof[] {
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return [];

  const proofs = [...listLocalProofs(mintUrl, unit)].sort((left, right) => right.amount - left.amount);
  const selected: ProductProof[] = [];
  let total = 0;

  for (const proof of proofs) {
    selected.push(proof);
    total += proof.amount;
    if (total >= targetAmount) {
      return selected;
    }
  }

  return [];
}
