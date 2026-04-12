import { browser } from '$app/environment';
import type { ProductProof } from '$lib/cascade/api';

const STORAGE_VERSION = 1;

type StoredProofWallet = {
  version: number;
  mintUrl: string;
  unit: string;
  proofs: ProductProof[];
  updatedAt: number;
};

function storageKey(mintUrl: string, unit: string): string {
  return `cascade:proof-wallet:${mintUrl}:${unit}`;
}

function normalizeMintUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function readLocalProofWallet(mintUrl: string, unit: string): StoredProofWallet {
  if (!browser) {
    return {
      version: STORAGE_VERSION,
      mintUrl: normalizeMintUrl(mintUrl),
      unit,
      proofs: [],
      updatedAt: 0
    };
  }

  const key = storageKey(normalizeMintUrl(mintUrl), unit);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return {
      version: STORAGE_VERSION,
      mintUrl: normalizeMintUrl(mintUrl),
      unit,
      proofs: [],
      updatedAt: 0
    };
  }

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
      mintUrl: normalizeMintUrl(
        typeof parsed.mintUrl === 'string' ? parsed.mintUrl : mintUrl
      ),
      unit: typeof parsed.unit === 'string' ? parsed.unit : unit,
      proofs,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    };
  } catch {
    return {
      version: STORAGE_VERSION,
      mintUrl: normalizeMintUrl(mintUrl),
      unit,
      proofs: [],
      updatedAt: 0
    };
  }
}

export function writeLocalProofWallet(wallet: StoredProofWallet): void {
  if (!browser) return;
  window.localStorage.setItem(
    storageKey(wallet.mintUrl, wallet.unit),
    JSON.stringify({
      ...wallet,
      version: STORAGE_VERSION,
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

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(keyPrefix))
    .map((key) => key.slice(keyPrefix.length))
    .filter(Boolean)
    .map((unit) => readLocalProofWallet(normalizedMintUrl, unit))
    .filter((wallet) => wallet.proofs.length > 0);
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
