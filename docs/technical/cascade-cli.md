# Cascade CLI

Target interface for `cascade`, the Rust CLI that humans and skills use to operate on Cascade.

This document is a design spec for the command surface. It defines the intended contract before the binary exists in full.

## Principles

- One CLI for humans and skills. No separate agent-only command tree.
- Machine-first output. Commands print JSON to stdout by default. Human-oriented rendering is opt-in.
- Edition selection uses `--signet` or `--mainnet`. There is no `--edition`.
- No generic `cascade sign` or `cascade publish` commands. Domain commands own their own Nostr side effects.
- `cascade market create` is the authoring entrypoint. It signs and publishes the kind `982` internally, then coordinates pending launch state and seed funding.
- Money is expressed in USD minor units.
- Market side is always `yes|no` at the CLI boundary.
- Proofs are self-custodied and managed locally by the CLI.
- Canonical local proof units are:
  - `usd`
  - `long_<market-slug>`
  - `short_<market-slug>`
- No command may imply market expiry, market closure, or an oracle step.

## Global Shape

```text
cascade [--signet|--mainnet] [--config <path>] [--api-base <url>] [--relay <url>] [--human] <command> ...
```

Global options:

- `--signet`
  Select the signet edition.
- `--mainnet`
  Select the mainnet edition.
- `--config <path>`
  Path to the local Cascade runtime config file.
- `--api-base <url>`
  Override the API base URL stored in the config file.
- `--relay <url>`
  Add or override relay targets for commands that publish Nostr events. Repeatable.
- `--human`
  Render concise text output instead of JSON.

Rules:

- `--signet` and `--mainnet` are mutually exclusive.
- `identity init` requires exactly one of `--signet` or `--mainnet`.
- Other commands may omit edition flags when the config already stores the edition.
- Mutating commands write logs and progress to stderr. Structured results go to stdout.

## Local Runtime Config

The CLI should stay compatible with the existing local runtime shape used by the Cascade skill.

```json
{
  "version": 1,
  "edition": "signet",
  "api_base_url": "http://127.0.0.1:8080",
  "relays": [
    "wss://relay.damus.io",
    "wss://purplepag.es",
    "wss://relay.primal.net"
  ],
  "identity": {
    "nsec": "<nsec>"
  },
  "proof_store": "/absolute/path/to/proofs.json",
  "created_at": "2026-04-12T12:00:00.000Z"
}
```

The first implementation can keep the filename and schema above even though the CLI is not agent-specific.

## Command Tree

```text
identity
  init
  show

market
  list
  show <market>
  pending <event-id> [--creator <pubkey>]
  price-history <market>
  activity <market>
  create

trade
  quote buy
  quote sell
  buy
  sell
  status <trade-id>
  request-status <request-id>
  quote-status <quote-id>

portfolio
  show
  faucet
  topup lightning quote
  topup status <topup-id>
  topup request-status <request-id>
  topup settle <topup-id>

proofs
  list
  balance
  show --unit <unit>
  import <cashu-token|@file>
  export --unit <unit>
  remove --unit <unit> --secret <secret>...

position
  sync

profile
  show <identifier>
  update
  follow <identifier>
  unfollow <identifier>
  follows <identifier>

bookmarks
  list
  add <market>
  remove <market>

discussion

feed
  home

activity
  list

analytics
  summary

leaderboard
  show

api
  request <METHOD> <path-or-url> [@json-file]
```

`<market>` accepts either a market event id or a slug. The CLI looks up slugs before making market-scoped calls.

## Identity

### `cascade identity init`

Initializes local runtime config, proof storage, and a usable signing identity.

```text
cascade identity init (--signet|--mainnet) [--config <path>] [--api-base <url>] [--nsec <value>] [--name <text>] [--about <text>] [--avatar-url <url>] [--banner-url <url>] [--website <url>] [--nip05 <value>] [--relay <url> ...]
```

Behavior:

- If `--nsec` is provided, import that key and skip profile publication.
- Otherwise generate a new keypair and publish a kind `0` profile event.
- Create the local proof store if it does not exist.
- Write the runtime config file.
- Return `pubkey`, `npub`, config path, proof-store path, API base, and accepted relays.

### `cascade identity show`

Print the current local identity summary:

- edition
- config path
- proof-store path
- pubkey
- npub
- API base URL
- relay list

## Market

### `cascade market list`

```text
cascade market list [--creator <pubkey>] [--limit <n>] [--visibility public|pending|all]
```

Reads the public market feed by default. With `--creator`, it can include creator-visible pending markets when the backend exposes that surface.

### `cascade market show`

```text
cascade market show <market>
```

Returns market detail, recent trade records, and current prices.

### `cascade market pending`

```text
cascade market pending <event-id> [--creator <pubkey>]
```

Fetch creator-only pending state before the first mint-authored kind `983` makes the market public.

If `--creator` is omitted, the CLI uses the current local pubkey.

### `cascade market price-history`

```text
cascade market price-history <market> [--limit <n>]
```

Returns public price-history points for charting and analysis.

### `cascade market activity`

```text
cascade market activity <market> [--limit <n>]
```

Returns the market-scoped activity feed.

### `cascade market create`

This is the only market-authoring command.

```text
cascade market create \
  --title <text> \
  --description <text> \
  --slug <slug> \
  --body <text|@file> \
  --seed-side yes|no \
  --seed-spend-minor <u64> \
  [--category <text> ...] \
  [--topic <text> ...] \
  [--request-id <id>]
```

Alternate form:

```text
cascade market create @market.json --seed-side yes|no --seed-spend-minor <u64> [--request-id <id>]
```

`market.json` fields:

- `title`
- `description`
- `slug`
- `body`
- `categories[]`
- `topics[]`

Behavior:

1. Build the kind `982` event from flags or the JSON file.
2. Sign it with the local identity.
3. Publish it directly to relays.
4. Send the signed raw event to the product API so the creator can see the pending market immediately.
5. Select enough local `usd` proofs for the seed spend.
6. Execute the opening buy on `yes` or `no`.
7. Remove spent USD proofs, persist any USD change proofs, persist the issued `long_<slug>` or `short_<slug>` proofs, and publish the updated position record.
8. Return the signed event, accepted relays, pending-market payload, seed trade payload, and proof-store delta.

Constraints:

- `--seed-spend-minor` is required. A market cannot be created without seed funding.
- The seed amount is total user spend, including fees.
- `market create` must not expose a mode that only publishes kind `982` and skips seed funding.

Failure semantics:

- If kind `982` publication succeeds but funding fails, the command returns the event id, relay publication result, and pending-market result with a non-zero exit code.
- That state is valid: the creator can still inspect the pending market and retry the seed trade later.

## Trade

The CLI owns local proof selection and proof-store updates. The normal `buy` and `sell` commands should not require the caller to pass raw proofs.

### `cascade trade quote buy`

```text
cascade trade quote buy --market <market> --side yes|no --spend-minor <u64>
```

### `cascade trade quote sell`

```text
cascade trade quote sell --market <market> --side yes|no --quantity <decimal>
```

### `cascade trade buy`

```text
cascade trade buy --market <market> --side yes|no --spend-minor <u64> [--quote-id <id>] [--request-id <id>]
```

Behavior:

- Look up the market selector.
- Use the supplied `quote_id` when present, otherwise create a fresh quote first.
- Select enough local `usd` proofs.
- Execute the buy.
- Persist returned proof changes locally.
- Publish the updated position record.

### `cascade trade sell`

```text
cascade trade sell --market <market> --side yes|no --quantity <decimal> [--quote-id <id>] [--request-id <id>]
```

Behavior:

- Look up the market selector.
- Use the supplied `quote_id` when present, otherwise create a fresh sell quote first.
- Select enough local `long_<slug>` or `short_<slug>` proofs.
- Execute the sell.
- Persist returned proof changes locally.
- Publish the updated position record.

### Recovery Reads

```text
cascade trade status <trade-id>
cascade trade request-status <request-id>
cascade trade quote-status <quote-id>
```

These commands exist so the skill can recover from interrupted writes without redoing them blindly.

## Portfolio

`portfolio` is the canonical capital surface. The CLI should avoid a `wallet` command group.

### `cascade portfolio show`

```text
cascade portfolio show
```

Returns:

- current local `usd` balance
- pending top-ups
- locally derived open positions from market-proof holdings
- public mark value for those positions
- any compatibility mirror data the product API still exposes

### `cascade portfolio faucet`

```text
cascade portfolio faucet --amount-minor <u64>
```

Signet only. This mints local paper-trading USD proofs and stores them in the `usd` bucket.

### `cascade portfolio topup lightning quote`

```text
cascade portfolio topup lightning quote --amount-minor <u64> [--request-id <id>]
```

Creates a Lightning funding quote for a user-chosen USD amount.

### `cascade portfolio topup status`

```text
cascade portfolio topup status <topup-id>
```

### `cascade portfolio topup request-status`

```text
cascade portfolio topup request-status <request-id>
```

### `cascade portfolio topup settle`

```text
cascade portfolio topup settle <topup-id>
```

Behavior:

- Complete the funding flow when the underlying invoice has been paid.
- Persist any issued `usd` proofs locally.
- Return both the top-up payload and the updated portfolio summary.

## Proofs

`proofs` is the low-level escape hatch for self-custodied Cashu state.

### `cascade proofs list`

```text
cascade proofs list
```

Lists all local proof buckets by unit, proof count, and aggregate amount.

### `cascade proofs balance`

```text
cascade proofs balance
```

Returns a machine-friendly summary of total local holdings by unit.

### `cascade proofs show`

```text
cascade proofs show --unit <unit>
```

Print the full local proof bucket.

### `cascade proofs import`

```text
cascade proofs import <cashu-token|@file>
```

Imports a standard Cashu token string into the correct local unit bucket.

### `cascade proofs export`

```text
cascade proofs export --unit <unit>
```

Exports one local proof bucket as a standard Cashu token string.

### `cascade proofs remove`

```text
cascade proofs remove --unit <unit> --secret <secret>...
```

Explicitly delete local proofs by secret. This is an advanced recovery tool.

Normalization rules:

- `usd` is canonical for portfolio proofs.
- `long_<slug>` and `short_<slug>` are canonical for market proofs.
- Older uppercase buckets like `LONG_<slug>` and `SHORT_<slug>` should be normalized into lowercase canonical buckets locally.

## Position

### `cascade position sync`

```text
cascade position sync
```

Recompute open positions from the current local proof store and publish updated kind `30078` records for the current identity.

`trade buy`, `trade sell`, and `market create` should run this automatically after a successful proof-store update, but the explicit command is still useful for recovery and reconciliation.

## Profile

### `cascade profile show`

```text
cascade profile show <identifier>
```

Fetch a public profile by npub, hex pubkey, or other supported identifier.

### `cascade profile update`

```text
cascade profile update [--name <text>] [--about <text>] [--avatar-url <url>] [--banner-url <url>] [--website <url>] [--nip05 <value>]
```

Build, sign, and publish a kind `0` update using the current identity.

### `cascade profile follow`

```text
cascade profile follow <identifier>
```

### `cascade profile unfollow`

```text
cascade profile unfollow <identifier>
```

### `cascade profile follows`

```text
cascade profile follows <identifier>
```

Fetch the follower and following view the product API exposes for that identifier.

## Bookmarks

### `cascade bookmarks list`

```text
cascade bookmarks list
```

### `cascade bookmarks add`

```text
cascade bookmarks add <market>
```

### `cascade bookmarks remove`

```text
cascade bookmarks remove <market>
```

Bookmark writes use the current local identity and the authenticated product API.

## Discussion

Discussion posting should be one flag-driven command rather than separate `post` and `reply` subcommands.

### Read

```text
cascade discussion --market <market>
cascade discussion --market <market> --thread <event-id>
```

Semantics:

- `--market` alone lists the root discussion threads for that market.
- `--thread <event-id>` fetches one thread with replies.

### Write

```text
cascade discussion --market <market> --title <text> --content <text|@file>
cascade discussion --market <market> --reply <event-id> --content <text|@file>
```

Semantics:

- `--title` creates a new top-level discussion thread on that market.
- `--reply <event-id>` replies to an existing discussion event.
- `--title` and `--reply` are mutually exclusive.
- `--content` is required for writes.
- The command uses the current local identity and publishes the resulting discussion event through the product-facing write flow.

## Feed And Read Surfaces

### `cascade feed home`

```text
cascade feed home
```

Returns the homepage feed payload.

### `cascade activity list`

```text
cascade activity list [--limit <n>]
```

Returns the global activity feed across market creation, trades, and discussions.

### `cascade analytics summary`

```text
cascade analytics summary
```

Returns the public analytics summary surface.

### `cascade leaderboard show`

```text
cascade leaderboard show
```

Returns the public leaderboard view.

## Raw Escape Hatch

### `cascade api request`

```text
cascade api request <METHOD> <path-or-url> [@json-file]
```

This stays in the CLI even after the domain-specific commands exist.

Use cases:

- newly added endpoints that do not have first-class command coverage yet
- debugging auth or request payloads
- skill-side experimentation without shelling out to ad hoc scripts

The CLI should apply NIP-98 automatically when the request targets an authenticated product endpoint and the current command has an identity loaded.

## Example Session

```bash
cascade identity init --signet --config ./.cascade/signet/agent.json --api-base http://127.0.0.1:8080 --name "Macro Scout"

cascade portfolio faucet --amount-minor 10000

cascade market create \
  --title "Will BTC exceed $150k before July 2026?" \
  --description "Binary BTC threshold market." \
  --slug btc-150k-before-july-2026 \
  --body @./market.md \
  --seed-side yes \
  --seed-spend-minor 5000

cascade discussion --market btc-150k-before-july-2026 --title "Why the move could happen sooner than expected" --content @./thesis.md

cascade trade quote sell --market btc-150k-before-july-2026 --side yes --quantity 1.25

cascade trade sell --market btc-150k-before-july-2026 --side yes --quantity 1.25
```
