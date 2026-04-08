# Nostr Event Kinds

Complete reference for all Nostr event kinds used by Cascade.

## Summary

| Kind | Description | Replaceable? | Publisher |
|------|-------------|--------------|-----------|
| 982 | Market definition | No | User |
| 983 | Trade record | No | Mint |
| 984 | Market resolution | No | Creator / Oracle |
| 1111 | Comments / discussions (NIP-22) | No | User |
| 10003 | Bookmarks (NIP-51) | Yes | User |
| 30078 | Positions (NIP-78) | Yes | User |

---

## Kind 982 — Market Definition

The canonical market event. Immutable once published.

```
kind: 982
pubkey: <creator's pubkey>
content: <markdown — the market's full written case, rationale, sources>
tags:
  ["title", "<human-readable market title>"]
  ["d", "<slug — URL-safe unique identifier, e.g. 'btc-100k-dec-2026'>"]
  ["c", "<category>"]           # repeatable
  ["description", "<one-line summary>"]
  ["status", "open" | "resolved" | "archived"]
  ["t", "<topic-hashtag>"]      # repeatable
```

**Key rules:**
- Kind 982 only. Not kind 30000. Not any replaceable kind.
- Non-replaceable — immutable once published. Do not use a replaceable kind.
- Only `E` tags for references (e.g., linking to related markets). Never `A` tags.
- No `version: 1` tag.
- No expiry tags. Markets never expire.
- `created_at` is the market's open timestamp.
- Resolution state is NOT stored on the kind 982 event — use kind 984.

**The `d` tag (slug):**
The slug is the stable, URL-safe identifier for the market. It's used in routing (`/market/[slug]`). It must be unique per creator pubkey.

**The `content` field:**
Full markdown. This is the market's written argument — the thesis, evidence, sources, and resolution criteria. Displayed prominently on the market page.

---

## Kind 983 — Trade Record

Published by the **mint** after every trade. This is the public audit log of all trading activity.

```
kind: 983
pubkey: <mint's pubkey>
content: ""
tags:
  ["e", "<kind-982-market-event-id>"]
  ["amount", "<sats>"]
  ["unit", "sat"]
  ["direction", "yes" | "no"]
  ["type", "issue" | "redeem"]
  ["price", "<ppm>"]
```

**Field notes:**

- **`pubkey`**: The mint's own Nostr pubkey — not the trader's pubkey
- **No trader pubkey**: Cashu is a bearer token system. The mint doesn't know who holds the tokens. Trades are anonymous by design.
- **`direction`**: `"yes"` = LONG side, `"no"` = SHORT side
- **`type`**: `"issue"` = tokens minted (user bought shares, market cap grew). `"redeem"` = tokens burned (user sold shares).
- **`price`**: Parts per million (ppm), where 0 = 0% and 1000000 = 100%. Example: `500000` = 50%, `720000` = 72%.
- **`amount`**: The sat amount of the trade

**Purpose:**
Kind 983 events let anyone reconstruct the trading history of any market. They're the audit log — the source of truth is the mint's database, but kind 983 provides public verifiability.

---

## Kind 984 — Market Resolution

Published by the market creator (or an oracle service) when the real-world outcome is known.

```
kind: 984
pubkey: <resolver's pubkey>
content: "<resolution rationale — explain why this outcome was chosen>"
tags:
  ["e", "<kind-982-market-event-id>"]
  ["resolution", "YES" | "NO"]
  ["resolved_at", "<unix timestamp>"]
  ["oracle", "<pubkey of resolver>"]
```

**What this triggers:**
The mint monitors for kind 984 events referencing markets it manages. Upon seeing a valid resolution event from the market creator:
1. The market is marked as resolved
2. Winning-side shares can be redeemed at 1.0 sat/share (minus 1% fee)
3. Losing-side shares are marked worthless

**Who can publish:**
The market creator (whose pubkey matches the kind 982 `pubkey` field). In future implementations, a designated oracle service.

**Note:**
Markets can economically close without a kind 984 event — if the outcome is obvious, arbitrage will push prices to extremes naturally. But formal payout processing at the canonical 1.0 rate requires a kind 984 event.

---

## Kind 1111 — Discussions (NIP-22)

Standard NIP-22 threaded comments. Used for market discussions, creator clarifications, and analysis posts.

```
kind: 1111
pubkey: <author's pubkey>
content: "<comment text>"
tags:
  ["e", "<kind-982-market-event-id>", "", "root"]
  ["e", "<parent-comment-event-id>", "", "reply"]  # if replying to a comment
  ["p", "<parent-author-pubkey>"]
```

No Cascade-specific extensions — this is standard NIP-22.

---

## Kind 10003 — Bookmarks (NIP-51)

Standard NIP-51 replaceable bookmarks list. Users can bookmark markets they want to track.

```
kind: 10003
pubkey: <user's pubkey>
content: ""
tags:
  ["e", "<market-event-id>"]
  ["e", "<another-market-event-id>"]
```

Replaceable (kind 10000–19999 range). Last-write-wins. No Cascade-specific extensions.

---

## Kind 30078 — Positions (NIP-78)

User-side position records. Replaceable per (pubkey, d-tag) pair.

```
kind: 30078
pubkey: <user's pubkey>
content: ""
tags:
  ["d", "cascade:position:<marketId>:<direction>"]
  ["market", "<marketId>"]
  ["direction", "YES" | "NO"]
  ["amount", "<sats-committed>"]
  ["shares", "<shares-currently-held>"]
  ["avg_price", "<average-purchase-price-as-decimal>"]
```

**Notes:**
- Replaceable by d-tag: each (user, market, direction) has exactly one position record
- Last-write-wins — no concurrency issues since each user writes their own positions
- `direction` values: `"YES"` (LONG) or `"NO"` (SHORT)
- `avg_price` is a decimal between 0 and 1 (e.g., `"0.65"` for 65%)
- User-signed: the user's private key signs these events, not the mint

**Future:**
Positions may eventually be derived from kind 983 trade events rather than stored as kind 30078. The Cashu bearer model means the mint doesn't know who holds what — kind 30078 is a user-side record. If users start trading on multiple devices or via agents, kind 30078 becomes the authoritative position record.
