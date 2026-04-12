#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const usage = `Cascade Cashu Proof Store

Usage:
  node scripts/cashu-proof-store.mjs init <wallet-file>
  node scripts/cashu-proof-store.mjs balance <wallet-file>
  node scripts/cashu-proof-store.mjs list <wallet-file>
  node scripts/cashu-proof-store.mjs import <wallet-file> <proofs-json-file> [mint]
  node scripts/cashu-proof-store.mjs export <wallet-file> <out-json-file> [mint]
  node scripts/cashu-proof-store.mjs remove <wallet-file> <secret1,secret2,...>

Wallet file schema:
  {
    "version": 1,
    "updated_at": "2026-04-10T00:00:00.000Z",
    "proofs": [
      {
        "amount": 1000,
        "secret": "...",
        "C": "...",
        "id": "...",
        "mint": "https://mint.example"
      }
    ]
  }

Proof input schema:
  - an array of proof objects
  - or an object with a "proofs" array
  - optional top-level "mint" applies to all imported proofs
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function printUsage() {
  console.log(usage);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyStore() {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    proofs: []
  };
}

async function loadJson(path) {
  const raw = await readFile(resolve(path), 'utf8');
  return JSON.parse(raw);
}

async function saveJson(path, value) {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function loadStore(path) {
  try {
    const raw = await loadJson(path);
    if (!isRecord(raw) || !Array.isArray(raw.proofs)) {
      fail(`Invalid wallet file: ${path}`);
    }

    return {
      version: Number(raw.version) || 1,
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
      proofs: raw.proofs.map((proof) => normalizeProof(proof))
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      fail(`Wallet file not found: ${path}`);
    }

    throw error;
  }
}

function normalizeProof(value, mintOverride) {
  if (!isRecord(value)) fail('Invalid proof object in input bundle.');

  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    fail('Each proof must include a positive numeric "amount".');
  }

  if (typeof value.secret !== 'string' || value.secret.length === 0) {
    fail('Each proof must include a non-empty "secret".');
  }

  if (typeof value.C !== 'string' || value.C.length === 0) {
    fail('Each proof must include a non-empty "C".');
  }

  const normalized = {
    amount,
    secret: value.secret,
    C: value.C
  };

  if (typeof value.id === 'string' && value.id.length > 0) normalized.id = value.id;
  if (typeof value.witness === 'string' && value.witness.length > 0) normalized.witness = value.witness;
  if (isRecord(value.dleq)) normalized.dleq = value.dleq;

  const mint =
    typeof value.mint === 'string' && value.mint.length > 0
      ? value.mint
      : typeof mintOverride === 'string' && mintOverride.length > 0
        ? mintOverride
        : undefined;
  if (mint) normalized.mint = mint;

  return normalized;
}

function normalizeProofBundle(raw, mintOverride) {
  if (Array.isArray(raw)) {
    return raw.map((proof) => normalizeProof(proof, mintOverride));
  }

  if (isRecord(raw) && Array.isArray(raw.proofs)) {
    const bundleMint =
      typeof raw.mint === 'string' && raw.mint.length > 0 ? raw.mint : mintOverride;
    return raw.proofs.map((proof) => normalizeProof(proof, bundleMint));
  }

  fail('Proof bundle must be an array or an object with a "proofs" array.');
}

function dedupeProofs(proofs) {
  const seen = new Set();
  const deduped = [];

  for (const proof of proofs) {
    if (seen.has(proof.secret)) continue;
    seen.add(proof.secret);
    deduped.push(proof);
  }

  return deduped;
}

function summarizeByMint(proofs) {
  const byMint = new Map();

  for (const proof of proofs) {
    const mint = proof.mint || 'unknown';
    const current = byMint.get(mint) || { proofs: 0, balance: 0 };
    current.proofs += 1;
    current.balance += proof.amount;
    byMint.set(mint, current);
  }

  return [...byMint.entries()]
    .map(([mint, stats]) => ({ mint, ...stats }))
    .sort((left, right) => left.mint.localeCompare(right.mint));
}

async function run() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'init') {
    const [walletFile] = args;
    if (!walletFile) fail('Usage: init <wallet-file>');
    await saveJson(walletFile, emptyStore());
    console.log(`Initialized proof store: ${resolve(walletFile)}`);
    return;
  }

  if (command === 'balance') {
    const [walletFile] = args;
    if (!walletFile) fail('Usage: balance <wallet-file>');
    const store = await loadStore(walletFile);
    const summary = summarizeByMint(store.proofs);
    console.log(JSON.stringify({ total_proofs: store.proofs.length, by_mint: summary }, null, 2));
    return;
  }

  if (command === 'list') {
    const [walletFile] = args;
    if (!walletFile) fail('Usage: list <wallet-file>');
    const store = await loadStore(walletFile);
    console.log(JSON.stringify(store, null, 2));
    return;
  }

  if (command === 'import') {
    const [walletFile, proofsFile, mintOverride] = args;
    if (!walletFile || !proofsFile) {
      fail('Usage: import <wallet-file> <proofs-json-file> [mint]');
    }

    const store = await loadStore(walletFile);
    const imported = normalizeProofBundle(await loadJson(proofsFile), mintOverride);
    store.proofs = dedupeProofs([...store.proofs, ...imported]);
    store.updated_at = new Date().toISOString();
    await saveJson(walletFile, store);

    console.log(
      JSON.stringify(
        {
          imported: imported.length,
          total_proofs: store.proofs.length,
          by_mint: summarizeByMint(store.proofs)
        },
        null,
        2
      )
    );
    return;
  }

  if (command === 'export') {
    const [walletFile, outFile, mintFilter] = args;
    if (!walletFile || !outFile) fail('Usage: export <wallet-file> <out-json-file> [mint]');

    const store = await loadStore(walletFile);
    const proofs = mintFilter
      ? store.proofs.filter((proof) => proof.mint === mintFilter)
      : store.proofs;

    await saveJson(outFile, { proofs });
    console.log(`Exported ${proofs.length} proofs to ${resolve(outFile)}`);
    return;
  }

  if (command === 'remove') {
    const [walletFile, secretList] = args;
    if (!walletFile || !secretList) fail('Usage: remove <wallet-file> <secret1,secret2,...>');

    const secrets = new Set(
      secretList
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    );
    const store = await loadStore(walletFile);
    const before = store.proofs.length;
    store.proofs = store.proofs.filter((proof) => !secrets.has(proof.secret));
    store.updated_at = new Date().toISOString();
    await saveJson(walletFile, store);

    console.log(
      JSON.stringify(
        {
          removed: before - store.proofs.length,
          total_proofs: store.proofs.length,
          by_mint: summarizeByMint(store.proofs)
        },
        null,
        2
      )
    );
    return;
  }

  fail(`Unknown command: ${command}\n\n${usage}`);
}

await run();
