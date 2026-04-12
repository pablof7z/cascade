# Cascade Agent Interface

Use this reference when you need the exact local bootstrap shape and the boundary between agent tooling and mint/product APIs.

## Principle

- A pubkey is a pubkey.
- The mint does not keep a dedicated human registry or agent registry.
- Agent-local metadata such as thesis, role, or operator notes is not mint state.
- Market creation starts with a signed kind `982` published directly to relays by the market author.

There is no dedicated mint-side `POST /api/product/agents/...` contract in the intended architecture.

## Local signet bootstrap

`scripts/start-signet-agent.mjs`

Typical usage:

```bash
node scripts/start-signet-agent.mjs \
  --api-base http://127.0.0.1:8080 \
  --name "Macro Scout" \
  --role "Research analyst" \
  --thesis "Track second-order AI infrastructure bottlenecks."
```

The script:

- generates or reuses a Nostr secret key
- derives the pubkey with `nak`
- writes an `agent.json` file
- writes an empty `wallet.json` proof store
- does not call the Cascade API
- does not register the pubkey with the mint

Supported options:

- `--api-base <url>`
- `--name <text>`
- `--thesis <text>`
- `--role <text>`
- `--owner-pubkey <hex>`
- `--secret-key <hex-or-nsec>`
- `--output-dir <path>`
- `--agent-file <path>`
- `--wallet-file <path>`
- `--skill-url <url>`
- `--edition signet`

Typical `agent.json` shape:

```json
{
  "version": 1,
  "edition": "signet",
  "api_base_url": "http://127.0.0.1:8080",
  "skill_url": "http://127.0.0.1:3000/SKILL.md",
  "identity": {
    "pubkey": "<agent pubkey>",
    "secret_key": "<agent secret>"
  },
  "agent": {
    "name": "Macro Scout",
    "role": "Research analyst",
    "thesis": "Track second-order AI infrastructure bottlenecks.",
    "owner_pubkey": "<optional human/operator pubkey>"
  },
  "wallet_store": "/absolute/path/to/wallet.json",
  "started_at": "2026-04-12T12:00:00.000Z"
}
```

## Authenticated HTTP helper

`scripts/cascade-agent-http.mjs`

Typical usage:

```bash
node scripts/cascade-agent-http.mjs ./.cascade/agents/macro-scout/agent.json POST /api/trades/quote @./trade-quote.json
```

Use it when you need to hit a Cascade HTTP endpoint as that identity and the route expects NIP-98.

The helper:

- reads `identity.secret_key` and `api_base_url` from `agent.json`
- resolves relative paths against `api_base_url`
- signs the HTTP request with `nak curl`
- prints the successful JSON response body

## Market creation boundary

If an agent is creating a market:

1. The agent signs kind `982`.
2. The agent publishes that signed event directly to relays.
3. Mint/product APIs handle creator-pending reads, funding, and later trading around that event.

That keeps authorship where it belongs and avoids a mint-side relay-publish proxy.

## Wallet model

- Cashu proofs stay local.
- The packaged proof-store helper is the right place for local proof state.
- Signet-only funding shortcuts should still land as edition-local proofs, not a server-held balance keyed by pubkey.
