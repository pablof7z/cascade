import { browser } from '$app/environment';
import { Mint, Wallet, type CounterSource, type MintQuoteState } from '@cashu/cashu-ts';
import { normalizeMintUrl, storageKey } from '$lib/cascade/config';
import type { BlindedMessageInput, ProductProof, TokenOutput } from '$lib/cascade/api';
import { toProductProof } from '$lib/wallet/cashuTokens';

export type Bolt11MintQuote = {
  quote: string;
  request: string;
  amount: number;
  unit: string;
  state: MintQuoteState | string;
  expiry?: number | null;
};

export type PendingMintPreparation = {
  counterStart: number;
  keysetId: string;
  outputCount?: number;
};

export type PendingOutputPreparation = PendingMintPreparation & {
  outputCount: number;
  amount: number;
  unit: string;
};

type ApiError = {
  detail?: string;
  error?: string;
};

function seedStorageKey(mintUrl: string): string {
  return `${storageKey('cascade_cashu_wallet_seed')}:${normalizeMintUrl(mintUrl)}`;
}

function counterStorageKey(mintUrl: string, keysetId: string): string {
  return `${storageKey('cascade_cashu_wallet_counter')}:${normalizeMintUrl(mintUrl)}:${keysetId}`;
}

function requireBrowser(): void {
  if (!browser) {
    throw new Error('Cashu wallet operations require a browser runtime.');
  }
}

function encodeBytesBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

function decodeBytesBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getOrCreateSeed(mintUrl: string): Uint8Array {
  requireBrowser();
  const key = seedStorageKey(mintUrl);
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return decodeBytesBase64(existing);
  }

  const seed = crypto.getRandomValues(new Uint8Array(32));
  window.localStorage.setItem(key, encodeBytesBase64(seed));
  return seed;
}

function getCounter(mintUrl: string, keysetId: string): number {
  requireBrowser();
  const raw = window.localStorage.getItem(counterStorageKey(mintUrl, keysetId));
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function setCounter(mintUrl: string, keysetId: string, next: number): void {
  requireBrowser();
  window.localStorage.setItem(counterStorageKey(mintUrl, keysetId), String(Math.max(0, next)));
}

function advanceCounter(mintUrl: string, keysetId: string, next: number): void {
  const current = getCounter(mintUrl, keysetId);
  if (next > current) {
    setCounter(mintUrl, keysetId, next);
  }
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  return payload?.detail || payload?.error || fallback;
}

async function cashuWallet(mintUrl: string, unit = 'usd'): Promise<Wallet> {
  const normalizedMintUrl = normalizeMintUrl(mintUrl);
  const wallet = new Wallet(new Mint(normalizedMintUrl), {
    unit,
    bip39seed: getOrCreateSeed(normalizedMintUrl),
    counterSource: localCounterSource(normalizedMintUrl)
  });
  await wallet.loadMint();
  return wallet;
}

function localCounterSource(mintUrl: string): CounterSource {
  const normalizedMintUrl = normalizeMintUrl(mintUrl);

  return {
    async reserve(keysetId, count) {
      const start = getCounter(normalizedMintUrl, keysetId);
      setCounter(normalizedMintUrl, keysetId, start + count);
      return { start, count };
    },
    async advanceToAtLeast(keysetId, minNext) {
      advanceCounter(normalizedMintUrl, keysetId, minNext);
    },
    async setNext(keysetId, next) {
      setCounter(normalizedMintUrl, keysetId, next);
    },
    async snapshot() {
      return {};
    }
  };
}

export async function createUsdLightningMintQuote(
  mintUrl: string,
  amountMinor: number,
  options?: {
    description?: string;
    pubkey?: string;
    requestId?: string;
  }
): Promise<Bolt11MintQuote> {
  const response = await fetch(`${normalizeMintUrl(mintUrl)}/v1/mint/quote/bolt11`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountMinor,
      unit: 'usd',
      description: options?.description,
      pubkey: options?.pubkey,
      request_id: options?.requestId
    })
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Lightning funding quote creation failed.'));
  }

  return (await response.json()) as Bolt11MintQuote;
}

export async function checkUsdLightningMintQuote(
  mintUrl: string,
  quoteId: string
): Promise<Bolt11MintQuote> {
  const response = await fetch(`${normalizeMintUrl(mintUrl)}/v1/mint/quote/bolt11/${quoteId}`, {
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to load Lightning mint quote status.'));
  }
  return (await response.json()) as Bolt11MintQuote;
}

async function prepareMint(
  mintUrl: string,
  wallet: Wallet,
  amountMinor: number,
  existing?: PendingMintPreparation
) {
  const keys = wallet.getKeyset(existing?.keysetId);
  const internalWallet = wallet as unknown as InternalWalletOps;
  const defaultOutputType = internalWallet.defaultOutputType();
  const configuredOutputs = internalWallet.configureOutputs(
    amountMinor,
    keys,
    defaultOutputType,
    false,
    []
  );
  const outputType =
    configuredOutputs.type === 'deterministic' && typeof existing?.counterStart === 'number'
      ? { ...configuredOutputs, counter: existing.counterStart }
      : configuredOutputs;

  const { outputTypes } = await internalWallet.addCountersToOutputTypes(keys.id, outputType);
  const preparedOutputType = outputTypes[0];
  const counterStart =
    preparedOutputType.type === 'deterministic' ? (preparedOutputType.counter ?? 0) : 0;
  const outputs = internalWallet.createOutputData(amountMinor, keys, preparedOutputType);

  return {
    keys,
    counterStart,
    outputs,
    preparation: {
      counterStart,
      outputCount: outputs.length,
      keysetId: keys.id
    } satisfies PendingMintPreparation
  };
}

type OutputDataLike = {
  blindedMessage: BlindedMessageInput;
  toProof: (signature: { amount: number; id: string; C_: string }, keyset: unknown) => unknown;
};

type InternalOutputType = {
  type: string;
  counter?: number;
  denominations?: number[];
};

type InternalWalletOps = {
  defaultOutputType: () => InternalOutputType;
  configureOutputs: (
    amount: number,
    keyset: unknown,
    outputType: InternalOutputType,
    includeFees: boolean,
    proofsWeHave: unknown[]
  ) => InternalOutputType;
  addCountersToOutputTypes: (
    keysetId: string,
    ...outputTypes: InternalOutputType[]
  ) => Promise<{ outputTypes: InternalOutputType[] }>;
  createOutputData: (
    amount: number,
    keyset: unknown,
    outputType: InternalOutputType
  ) => OutputDataLike[];
};

function asOutputDataLike(value: unknown): OutputDataLike {
  return value as OutputDataLike;
}

export async function prepareProofOutputs(
  mintUrl: string,
  unit: string,
  amountMinor: number,
  existing?: PendingOutputPreparation
): Promise<{ outputs: BlindedMessageInput[]; preparation: PendingOutputPreparation }> {
  const wallet = await cashuWallet(mintUrl, unit);
  const prepared = await prepareMint(normalizeMintUrl(mintUrl), wallet, amountMinor, existing);

  return {
    outputs: prepared.outputs.map((output: OutputDataLike) => asOutputDataLike(output).blindedMessage),
    preparation: {
      ...prepared.preparation,
      amount: amountMinor,
      unit
    }
  };
}

async function proofsFromPreparedOutputs(
  mintUrl: string,
  preparation: PendingOutputPreparation,
  signatures: TokenOutput[]
): Promise<ProductProof[]> {
  const wallet = await cashuWallet(mintUrl, preparation.unit);
  const normalizedMintUrl = normalizeMintUrl(mintUrl);
  const prepared = await prepareMint(normalizedMintUrl, wallet, preparation.amount, preparation);

  if (signatures.length !== prepared.outputs.length) {
    throw new Error('trade_signature_count_mismatch');
  }

  const proofs = prepared.outputs.map((output: OutputDataLike, index: number) =>
    toProductProof(
      asOutputDataLike(output).toProof(
        {
          amount: signatures[index].amount,
          id: signatures[index].id,
          C_: signatures[index].c_
        },
        prepared.keys
      ) as never
    )
  );

  advanceCounter(
    normalizedMintUrl,
    preparation.keysetId,
    preparation.counterStart + preparation.outputCount
  );

  return proofs;
}

export async function unblindPreparedOutputs(
  mintUrl: string,
  preparation: PendingOutputPreparation,
  signatures: TokenOutput[]
): Promise<ProductProof[]> {
  return proofsFromPreparedOutputs(mintUrl, preparation, signatures);
}

export async function restorePreparedOutputs(
  mintUrl: string,
  preparation: PendingOutputPreparation
): Promise<ProductProof[]> {
  const wallet = await cashuWallet(mintUrl, preparation.unit);
  const restored = await wallet.restore(preparation.counterStart, preparation.outputCount, {
    keysetId: preparation.keysetId
  });

  advanceCounter(
    normalizeMintUrl(mintUrl),
    preparation.keysetId,
    preparation.counterStart + preparation.outputCount
  );

  return restored.proofs.map(toProductProof);
}

export async function mintUsdLightningQuote(
  mintUrl: string,
  quoteId: string,
  amountMinor: number,
  existing?: PendingMintPreparation
): Promise<{ proofs: ProductProof[]; preparation: PendingMintPreparation }> {
  const wallet = await cashuWallet(mintUrl, 'usd');
  const normalizedMintUrl = normalizeMintUrl(mintUrl);
  const keys = wallet.getKeyset(existing?.keysetId);
  const counterStart = existing?.counterStart ?? (await wallet.counters.peekNext(keys.id));
  await wallet.counters.setNext(keys.id, counterStart);
  const proofs = await wallet.mintProofs(amountMinor, quoteId, {
    keysetId: keys.id
  });

  const nextCounter = await wallet.counters.peekNext(keys.id);
  const outputCount = nextCounter - counterStart;
  advanceCounter(normalizedMintUrl, keys.id, nextCounter);

  return {
    proofs: proofs.map(toProductProof),
    preparation: {
      counterStart,
      keysetId: keys.id,
      outputCount
    }
  };
}

export async function prepareUsdLightningMint(
  mintUrl: string,
  _amountMinor: number,
  existing?: PendingMintPreparation
): Promise<PendingMintPreparation> {
  const wallet = await cashuWallet(mintUrl, 'usd');
  const keys = wallet.getKeyset(existing?.keysetId);

  return {
    counterStart: existing?.counterStart ?? (await wallet.counters.peekNext(keys.id)),
    keysetId: keys.id
  };
}

export async function restoreUsdLightningQuote(
  mintUrl: string,
  preparation: PendingMintPreparation
): Promise<ProductProof[]> {
  const wallet = await cashuWallet(mintUrl, 'usd');
  const restored =
    typeof preparation.outputCount === 'number' && preparation.outputCount > 0
      ? await wallet.restore(preparation.counterStart, preparation.outputCount, {
          keysetId: preparation.keysetId
        })
      : await wallet.batchRestore(32, 16, preparation.counterStart, preparation.keysetId);

  const nextCounter =
    typeof restored.lastCounterWithSignature === 'number'
      ? restored.lastCounterWithSignature + 1
      : preparation.counterStart + restored.proofs.length;

  advanceCounter(
    normalizeMintUrl(mintUrl),
    preparation.keysetId,
    nextCounter
  );

  return restored.proofs.map(toProductProof);
}
