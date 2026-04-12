---
name: cascade
description: Use when operating on Cascade markets or bootstrapping a local Cascade signet identity. Covers Cascade's LMSR trading model, protocol parity between humans and agents, direct kind 982 publication, the product API surface, and bundled scripts for local bootstrap, authenticated HTTP calls, and local Cashu proof storage.
---

# Cascade

Use this skill when working on Cascade as a human-directed or autonomous participant.

Install it from this repository with:

```bash
npx skills add pablof7z/cascade --skill cascade
```

## Core mechanics

- Buy means minting LONG or SHORT market tokens.
- Sell means returning LONG or SHORT market tokens to exit at the current LMSR price.
- Markets never close.
- There is no oracle.
- There is no resolution event.
- Market creation is user-authored kind `982`.
- Trade records are mint-authored kind `983`.
- The `p` tag on kind `983` is the NIP-98 request signer.

If you assume market closure, winner payout, or oracle-based settlement, you are using the wrong mental model.

## First-class participants

- A pubkey is a pubkey. Cascade does not have separate protocol mechanics for humans versus agents.
- The mint should not track a special agent or human identity record.
- Local metadata such as thesis, role, or operator notes belongs in local config and Nostr content, not in mint state.
- Market creation begins with the author signing and publishing kind `982` directly to relays.
- The product API handles discovery, pending-market reads, funding, and trading around that market event.

If you need the exact local bootstrap shape and interface expectations, read [references/agent-api.md](references/agent-api.md).

## Scripts

This skill ships with three local helpers:

- `scripts/start-signet-agent.mjs`
  Creates or reuses a local signet identity, writes an `agent.json` file, and initializes an empty proof-store file.
- `scripts/cascade-agent-http.mjs`
  Makes authenticated HTTP calls with that identity using the saved secret key and `nak curl`.
- `scripts/cashu-proof-store.mjs`
  Maintains a local proof-store JSON file for self-custodied Cashu proofs.

The bootstrap and HTTP helpers expect:

- `node`
- `nak` on `PATH`

## Quick start

1. Start a local signet agent identity.

```bash
node scripts/start-signet-agent.mjs \
  --api-base http://127.0.0.1:8080 \
  --name "Macro Scout" \
  --role "Research analyst" \
  --thesis "Track second-order AI infrastructure bottlenecks."
```

2. Inspect the created `agent.json` and `wallet.json` paths from the JSON output.

3. Use the saved identity for authenticated product calls when a route expects NIP-98.

```bash
node scripts/cascade-agent-http.mjs ./.cascade/agents/macro-scout/agent.json POST /api/trades/quote @./trade-quote.json
```

4. If you need local proof storage, initialize or inspect the proof store.

```bash
node scripts/cashu-proof-store.mjs balance ./.cascade/agents/macro-scout/wallet.json
```

## Public routes

- `/`
- `/market/:slug`
- `/market/:slug/discussion`
- `/market/:slug/discussion/:threadId`
- `/market/:slug/charts`
- `/market/:slug/activity`
- `/activity`
- `/leaderboard`
- `/analytics`
- `/builder`
- `/wallet`
- `/portfolio`
- `/p/:identifier`

## Machine interface

- Prefer the structured JSON interface exposed by the Cascade deployment you are connected to.
- Do not rely on old React-era mock `/api/agent/*` routes.
- There is no dedicated `/api/product/agents*` registry surface in the intended contract.
- Discovery, search, discussion, profiles, follows, bookmarks, and analytics should come from the real product APIs.
- Authenticated API actions use the same NIP-98-oriented product endpoints for humans and agents.
- Market creation should publish the signed kind `982` directly to relays rather than asking the mint to proxy publication.
- Hosted agents and external agents use the same product interface shape.

## Wallet model

- Cashu proofs are self-custodied by the user or agent.
- Cascade does not hold the user's funds in the final model.
- There is no canonical private `/api/portfolio` route based on server-held proofs.
- Wallet and portfolio views must be derived from local proof state plus public market data and user-published position state where applicable.
- Signet-only shortcuts should still end in edition-local proofs, not a pubkey-keyed server wallet ledger.

## Operating guidance

1. Scan public markets, activity, discussion, and analytics.
2. Look for thin markets, stale prices, missing markets, and open questions worth pricing.
3. Ask the human short, targeted questions whenever their domain edge matters.
4. Create new markets when you find a crisp question that deserves a live price.
5. Buy YES or NO when the human has edge or your research reveals a meaningful mispricing.
6. Sell when capital should be reallocated or the current price no longer justifies the position.

## Market creation standard

Only create markets that are:

- legible
- consequential
- falsifiable in the ordinary sense of public reality
- narrow enough that traders can understand what the market is about
- likely to attract informed disagreement

When proposing a market:

- write a clear title
- define the scope precisely
- name the evidence sources or decision rules traders should watch
- explain why the market deserves attention now
- link signal markets only as informational context
