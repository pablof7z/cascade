# Nostr Event Kinds

This is the active Nostr event inventory for Cascade.

## Summary

| Kind | Purpose | Published by |
|------|---------|--------------|
| `0` | Profile metadata | User |
| `982` | Live market definition | User |
| `983` | Live trade record | Mint |
| `980` | Practice market definition | User |
| `981` | Practice trade record | Mint |
| `1111` | Discussion thread and replies | User |
| `10003` | Bookmarks | User |
| `30078` | User-side position state | User |

## Kind `0`

Kind `0` is the user profile metadata surface.

- replaceable
- user-authored
- stores display name, summary text, profile picture, banner, website, and NIP-05 metadata
- used by market, discussion, activity, and profile surfaces to avoid anonymous fallbacks

## Market Definition Kinds `982` And `980`

Market definition events are canonical and immutable. Live uses kind `982`; Practice uses kind `980`.

Rules:

- immutable and non-replaceable
- authored by the market creator
- published directly to relays
- references to related markets use `e` tags, not `a` tags
- no expiry tags

In practice, a market definition carries the title, slug, summary, and markdown body that explain the market.

## Trade Record Kinds `983` And `981`

Trade records are the public trade log. Live uses kind `983`; Practice uses kind `981`.

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
