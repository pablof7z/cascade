import { getDecodedToken, getEncodedToken, type Proof, type Token } from '@cashu/cashu-ts';
import { normalizeMintUrl } from '$lib/cascade/config';
import type { ProductProof } from '$lib/cascade/api';
import type { StoredProofWallet } from '$lib/wallet/localProofs';

export type DecodedLocalProofToken = {
  mintUrl: string;
  unit: string;
  proofs: ProductProof[];
  amount: number;
};

function toCashuProof(proof: ProductProof): Proof {
  return {
    id: proof.id,
    amount: proof.amount,
    secret: proof.secret,
    C: proof.C,
    witness: proof.witness ?? undefined,
    dleq: proof.dleq
      ? {
          e: proof.dleq.e,
          s: proof.dleq.s,
          r: proof.dleq.r
        }
      : undefined
  };
}

function toProductProof(proof: Proof): ProductProof {
  if (proof.witness && typeof proof.witness !== 'string') {
    throw new Error('Importing witness-bearing proofs is not supported yet.');
  }

  if (proof.dleq && (!proof.dleq.e || !proof.dleq.s || !proof.dleq.r)) {
    throw new Error('Importing partial DLEQ proofs is not supported yet.');
  }

  const dleq =
    proof.dleq && proof.dleq.r
      ? {
          e: proof.dleq.e,
          s: proof.dleq.s,
          r: proof.dleq.r
        }
      : undefined;

  return {
    id: proof.id,
    amount: proof.amount,
    secret: proof.secret,
    C: proof.C,
    witness: typeof proof.witness === 'string' ? proof.witness : undefined,
    dleq
  };
}

function decodeBase64UrlUtf8(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  if (typeof atob !== 'function') {
    throw new Error('Base64 decoding is not available in this runtime.');
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeTokenV3(tokenString: string): Token | null {
  if (!tokenString.startsWith('cashuA')) {
    return null;
  }

  const raw = JSON.parse(decodeBase64UrlUtf8(tokenString.slice('cashuA'.length))) as {
    token?: Array<{ mint?: string; proofs?: Proof[] }>;
    unit?: string;
  };

  if (!Array.isArray(raw.token) || raw.token.length !== 1) {
    throw new Error('Imported token must contain exactly one mint entry.');
  }

  const entry = raw.token[0];
  if (!entry?.mint || !Array.isArray(entry.proofs)) {
    throw new Error('Imported token is missing mint or proofs.');
  }

  return {
    mint: entry.mint,
    unit: raw.unit || 'sat',
    proofs: entry.proofs
  };
}

export function encodeLocalProofWallet(wallet: StoredProofWallet): string {
  const token: Token = {
    mint: normalizeMintUrl(wallet.mintUrl),
    unit: wallet.unit,
    proofs: wallet.proofs.map(toCashuProof)
  };

  return getEncodedToken(token, { version: 3 });
}

export function decodeLocalProofToken(
  tokenString: string,
  expectedMintUrl?: string
): DecodedLocalProofToken {
  const trimmedToken = tokenString.trim();
  const decoded = decodeTokenV3(trimmedToken) ?? getDecodedToken(trimmedToken);
  const mintUrl = normalizeMintUrl(decoded.mint);

  if (expectedMintUrl && normalizeMintUrl(expectedMintUrl) !== mintUrl) {
    throw new Error('Token mint does not match this portfolio edition.');
  }

  if (!decoded.unit) {
    throw new Error('Imported token is missing a unit.');
  }

  const proofs = decoded.proofs.map(toProductProof);

  return {
    mintUrl,
    unit: decoded.unit,
    amount: proofs.reduce((sum: number, proof: ProductProof) => sum + proof.amount, 0),
    proofs
  };
}
