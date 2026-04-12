import { CashuWallet, deriveKeysetId } from '@cashu/cashu-ts';
import { getMintUrl, normalizeMintUrl } from '$lib/wallet/mint';

const PATCH_FLAG = '__cascade_cashu_wallet_keyset_compat__';
const LEGACY_CASCADE_MINT = 'https://mint.cascade.market';
const warnedKeysets = new Set<string>();

type WalletKeyset = {
  id: string;
  unit?: string;
  active?: boolean;
  final_expiry?: number;
  input_fee_ppk?: number;
  keys: Record<string, string>;
};

type WalletKeysetRef = Omit<WalletKeyset, 'keys'>;

type CompatibleCashuMint = {
  mintUrl?: string;
  getKeys: (keysetId?: string) => Promise<{ keysets: WalletKeyset[] }>;
  getKeySets: () => Promise<{ keysets: WalletKeysetRef[] }>;
};

type CompatibleCashuWallet = {
  _keys: Map<string, WalletKeyset>;
  _keysets: WalletKeysetRef[];
  _unit: string;
  mint: CompatibleCashuMint;
  getActiveKeyset: (keysets: WalletKeysetRef[]) => { id: string };
  keysetId: string;
};

declare global {
  var __cascade_cashu_wallet_keyset_compat__: boolean | undefined;
}

function mintHost(url: string | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function isHexKeysetId(id: string): boolean {
  return /^[a-fA-F0-9]+$/.test(id);
}

function deriveVersionByte(id: string): number {
  if (!isHexKeysetId(id) || id.length < 2) return 0;

  return Number.parseInt(id.slice(0, 2), 16);
}

function verifyKeysetIdLocally(keyset: WalletKeyset): boolean {
  try {
    const derived = deriveKeysetId(
      keyset.keys,
      keyset.unit,
      keyset.final_expiry,
      deriveVersionByte(keyset.id),
      !isHexKeysetId(keyset.id)
    );

    return derived === keyset.id;
  } catch {
    return false;
  }
}

function isCompatMint(mintUrl: string | undefined): boolean {
  const currentMintHost = mintHost(normalizeMintUrl(getMintUrl()));
  const legacyMintHost = mintHost(LEGACY_CASCADE_MINT);
  const host = mintHost(mintUrl);

  return Boolean(host && (host === currentMintHost || host === legacyMintHost));
}

function hasMatchingPublishedKeyset(wallet: CompatibleCashuWallet, keyset: WalletKeyset): boolean {
  return wallet._keysets.some(
    (knownKeyset: WalletKeysetRef) =>
      knownKeyset.id === keyset.id &&
      (knownKeyset.unit ?? wallet._unit) === (keyset.unit ?? wallet._unit) &&
      (knownKeyset.final_expiry ?? null) === (keyset.final_expiry ?? null)
  );
}

function isCompatibilityKeyset(wallet: CompatibleCashuWallet, keyset: WalletKeyset): boolean {
  if (verifyKeysetIdLocally(keyset)) return true;
  if (!isCompatMint(wallet.mint.mintUrl)) return false;
  if (!isHexKeysetId(keyset.id) || !keyset.id.startsWith('01')) return false;
  if (Object.keys(keyset.keys).length === 0) return false;
  if (!hasMatchingPublishedKeyset(wallet, keyset)) return false;

  const warningKey = `${wallet.mint.mintUrl ?? 'unknown'}:${keyset.id}`;
  if (!warnedKeysets.has(warningKey)) {
    warnedKeysets.add(warningKey);

    let derivedId: string | null = null;
    try {
      derivedId = deriveKeysetId(keyset.keys, keyset.unit, keyset.final_expiry, 1);
    } catch {
      derivedId = null;
    }

    console.warn(
      '[cashu-compat] accepting mint keyset with published ID that cashu-ts v2 cannot verify',
      {
        mint: wallet.mint.mintUrl,
        published: keyset.id,
        derived: derivedId
      }
    );
  }

  return true;
}

async function ensureKeysetsLoaded(wallet: CompatibleCashuWallet): Promise<WalletKeysetRef[]> {
  if (wallet._keysets.length > 0) return wallet._keysets;

  const response = await wallet.mint.getKeySets();
  wallet._keysets = response.keysets.filter(
    (keyset: WalletKeysetRef) => keyset.unit === wallet._unit
  );
  return wallet._keysets;
}

async function getAllKeysPatched(this: CashuWallet): Promise<WalletKeyset[]> {
  const wallet = this as unknown as CompatibleCashuWallet;
  await ensureKeysetsLoaded(wallet);

  const response = await wallet.mint.getKeys();
  response.keysets.forEach((keyset: WalletKeyset) => {
    if (!isCompatibilityKeyset(wallet, keyset)) {
      throw new Error(`Couldn't verify keyset ID ${keyset.id}`);
    }
  });

  wallet._keys = new Map(
    response.keysets.map((keyset: WalletKeyset) => [keyset.id, keyset] as const)
  );
  wallet.keysetId = wallet.getActiveKeyset(wallet._keysets).id;

  return response.keysets;
}

async function getKeysPatched(
  this: CashuWallet,
  keysetId?: string,
  forceRefresh?: boolean
): Promise<WalletKeyset | undefined> {
  const wallet = this as unknown as CompatibleCashuWallet;

  if (!(wallet._keysets.length > 0) || forceRefresh) {
    wallet._keysets = [];
    await ensureKeysetsLoaded(wallet);
  }

  if (!keysetId) {
    keysetId = wallet.getActiveKeyset(wallet._keysets).id;
  }

  if (!wallet._keysets.find((keyset: WalletKeysetRef) => keyset.id === keysetId)) {
    wallet._keysets = [];
    await ensureKeysetsLoaded(wallet);

    if (!wallet._keysets.find((keyset: WalletKeysetRef) => keyset.id === keysetId)) {
      throw new Error(`could not initialize keys. No keyset with id '${keysetId}' found`);
    }
  }

  if (!wallet._keys.get(keysetId)) {
    const response = await wallet.mint.getKeys(keysetId);
    const keyset = response.keysets[0];

    if (!keyset || !isCompatibilityKeyset(wallet, keyset)) {
      throw new Error(`Couldn't verify keyset ID ${keyset?.id ?? keysetId}`);
    }

    wallet._keys.set(keysetId, keyset);
  }

  wallet.keysetId = keysetId;
  return wallet._keys.get(keysetId);
}

if (!globalThis[PATCH_FLAG]) {
  globalThis[PATCH_FLAG] = true;

  const prototype = CashuWallet.prototype as unknown as {
    getAllKeys: typeof getAllKeysPatched;
    getKeys: typeof getKeysPatched;
  };

  prototype.getAllKeys = getAllKeysPatched;
  prototype.getKeys = getKeysPatched;
}

export {};
