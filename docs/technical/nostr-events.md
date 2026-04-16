# Nostr Event Kinds

This is the active Nostr event inventory for Cascade.

PENDING: Practice/signet market and trade events are moving to kinds `980` and `981`; Live/mainnet remains `982` and `983`.

## Summary

| Kind | Purpose | Published by |
|------|---------|--------------|
| `0` | Profile metadata | User |
| `982` | Market definition | User |
| `983` | Trade record | Mint |
| `1111` | Discussion thread and replies | User |
| `10003` | Bookmarks | User |
| `30078` | User-side position state | User |

## Kind `0`

Kind `0` is the user profile metadata surface.

- replaceable
- user-authored
- stores display name, summary text, profile picture, banner, website, and NIP-05 metadata
- used by market, discussion, activity, and profile surfaces to avoid anonymous fallbacks

## Kind `982`

Kind `982` is the canonical market-definition event.

Rules:

- immutable and non-replaceable
- authored by the market creator
- published directly to relays
- references to related markets use `e` tags, not `a` tags
- no expiry tags

In practice, a kind `982` carries the market title, slug, summary, and markdown body that explain the market.

## Kind `983`

Kind `983` is the public trade log.

Rules:

- authored by the mint, never the trader
- references the market with an `e` tag
- may include an optional `p` tag when the request used NIP-98
- records trade notional, unit, side, trade type, and price

Typical tag shape:

```text
["e", "<market-event-id>"]
["p", "<request-signer-pubkey>"]   # optional
["amount", "<integer>"]
["unit", "usd"]
["direction", "long" | "short"]
["type", "buy" | "sell"]
["price", "<ppm>"]
```

`p` is request attribution only. It is not proof ownership.

## Kind `1111`

Kind `1111` is the discussion layer.

- append-only
- user-authored
- used for market discussion and replies

Cascade uses it for market-centered conversation, not for a separate moderation system.

## Kind `10003`

Kind `10003` is the bookmark list.

- replaceable
- user-authored
- stores saved market references

## Kind `30078`

Kind `30078` is the user-side position state surface used today for portfolio and profile behavior.

- replaceable
- user-authored
- complements local proofs and local trade history

It is not a mint-side canonical balance ledger.
