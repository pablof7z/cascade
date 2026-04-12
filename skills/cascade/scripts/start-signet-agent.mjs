#!/usr/bin/env node

import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const usage = `Cascade signet agent bootstrap

Usage:
  node scripts/start-signet-agent.mjs --api-base <url> --name <name> --thesis <text> [options]

Required:
  --api-base <url>         Base URL to store for future Cascade product API calls
  --name <name>            Agent display name
  --thesis <text>          Agent thesis / operating direction

Optional:
  --role <text>            Agent role label
  --owner-pubkey <hex>     Human/operator pubkey to store locally
  --secret-key <value>     Existing hex or nsec to reuse instead of generating one
  --output-dir <path>      Output directory, default ./.cascade/agents/<slug>
  --agent-file <path>      Agent JSON output path
  --wallet-file <path>     Wallet proof-store output path
  --skill-url <url>        Hosted SKILL.md URL for this deployment
  --edition <name>         Bootstrap edition, currently signet only

Output:
  Prints a JSON summary with the agent pubkey and local file paths.

Notes:
  - This helper is local only. It does not call the Cascade API.
  - It creates an identity plus local config for a signet agent.
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      fail(`Unexpected argument: ${token}\n\n${usage}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      fail(`Missing value for --${key}\n\n${usage}`);
    }

    args.set(key, next);
    index += 1;
  }

  return args;
}

function requireArg(args, key) {
  const value = args.get(key);
  if (!value || value.trim().length === 0) {
    fail(`Missing required --${key}\n\n${usage}`);
  }
  return value.trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function runNak(args) {
  const result = spawnSync('nak', args, {
    encoding: 'utf8'
  });

  if (result.error) {
    fail(`Failed to execute nak: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(result.stderr?.trim() || `nak ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
}

async function writePrivateJson(path, value) {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await chmod(outputPath, 0o600);
  } catch {
    // Best effort only.
  }
}

function emptyProofStore() {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    proofs: []
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiBase = requireArg(args, 'api-base').replace(/\/+$/, '');
  const name = requireArg(args, 'name');
  const thesis = requireArg(args, 'thesis');
  const role = args.get('role')?.trim() || null;
  const ownerPubkey = args.get('owner-pubkey')?.trim() || null;
  const skillUrl = args.get('skill-url')?.trim() || null;
  const edition = args.get('edition')?.trim() || 'signet';

  if (edition !== 'signet') {
    fail(`Unsupported edition: ${edition}. This helper currently bootstraps signet only.`);
  }

  const secretKey = args.get('secret-key')?.trim() || runNak(['key', 'generate']);
  const pubkey = runNak(['key', 'public', secretKey]);

  const slug = slugify(name) || 'cascade-agent';
  const outputDir = resolve(args.get('output-dir') || `.cascade/agents/${slug}`);
  const agentFile = resolve(args.get('agent-file') || `${outputDir}/agent.json`);
  const walletFile = resolve(args.get('wallet-file') || `${outputDir}/wallet.json`);

  await writePrivateJson(walletFile, emptyProofStore());
  await writePrivateJson(agentFile, {
    version: 1,
    edition,
    api_base_url: apiBase,
    skill_url: skillUrl,
    identity: {
      pubkey,
      secret_key: secretKey
    },
    agent: {
      name,
      role,
      thesis,
      owner_pubkey: ownerPubkey
    },
    wallet_store: walletFile,
    started_at: new Date().toISOString()
  });

  console.log(
    JSON.stringify(
      {
        pubkey,
        edition,
        agent_file: agentFile,
        wallet_file: walletFile,
        api_base_url: apiBase
      },
      null,
      2
    )
  );
}

await main();
