#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const usage = `Cascade agent HTTP helper

Usage:
  node scripts/cascade-agent-http.mjs <agent-file> <METHOD> <url-or-path> [json-body-or-@file]

Examples:
  node scripts/cascade-agent-http.mjs ./.cascade/agents/macro-scout/agent.json POST /api/trades/quote @./trade-quote.json
  node scripts/cascade-agent-http.mjs ./.cascade/agents/macro-scout/agent.json GET https://cascade.example/api/product/feed

Notes:
  - Relative API paths are resolved against api_base_url from the agent file.
  - The helper signs the request with the saved secret key using \`nak curl\`.
  - Use this for authenticated product endpoints that expect NIP-98.
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function splitHttpResponse(output) {
  const trimmed = output.trimEnd();
  const newlineIndex = trimmed.lastIndexOf('\n');
  if (newlineIndex === -1) {
    fail(`Unexpected HTTP response payload: ${trimmed}`);
  }

  const body = trimmed.slice(0, newlineIndex);
  const status = Number(trimmed.slice(newlineIndex + 1));
  if (!Number.isInteger(status)) {
    fail(`Missing HTTP status code in response: ${trimmed}`);
  }

  return { body, status };
}

async function loadAgentFile(path) {
  const raw = await readFile(resolve(path), 'utf8');
  const parsed = JSON.parse(raw);
  const secretKey = parsed?.identity?.secret_key;
  const apiBaseUrl = parsed?.api_base_url;

  if (typeof secretKey !== 'string' || secretKey.length === 0) {
    fail(`Agent file is missing identity.secret_key: ${path}`);
  }
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.length === 0) {
    fail(`Agent file is missing api_base_url: ${path}`);
  }

  return { secretKey, apiBaseUrl: apiBaseUrl.replace(/\/+$/, '') };
}

async function resolveBody(value) {
  if (!value) return null;
  if (!value.startsWith('@')) return value;
  return readFile(resolve(value.slice(1)), 'utf8');
}

async function main() {
  const [agentFile, method, target, bodyArg] = process.argv.slice(2);
  if (!agentFile || !method || !target) {
    fail(usage);
  }

  const { secretKey, apiBaseUrl } = await loadAgentFile(agentFile);
  const url = target.startsWith('/') ? `${apiBaseUrl}${target}` : target;
  const body = await resolveBody(bodyArg);

  const curlArgs = ['curl', '-sS', '-X', method.toUpperCase(), '-w', '\n%{http_code}', url];

  if (body !== null) {
    curlArgs.push('-H', 'Content-Type: application/json', '--data-binary', body);
  }

  const result = spawnSync('nak', curlArgs, {
    encoding: 'utf8',
    env: {
      ...process.env,
      NOSTR_SECRET_KEY: secretKey
    }
  });

  if (result.error) {
    fail(`Failed to execute nak: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(result.stderr?.trim() || 'nak curl failed');
  }

  const { body: responseBody, status } = splitHttpResponse(result.stdout);
  if (status < 200 || status >= 300) {
    fail(`Request failed with HTTP ${status}\n${responseBody}`);
  }

  process.stdout.write(`${responseBody}\n`);
}

await main();
