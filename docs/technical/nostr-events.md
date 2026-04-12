# Nostr Event Kinds

Complete reference for all Nostr event kinds used by Cascade.

## Summary

| Kind | Description | Replaceable? | Publisher | Status |
|------|-------------|--------------|-----------|--------|
| 982 | Market definition | No | User | Implemented |
| 983 | Trade record | No | Mint | **Planned / in-progress** |
| 1111 | Comments / discussions (NIP-22) | No | User | Implemented |
| 10003 | Bookmarks (NIP-51) | Yes | User | Implemented |
| 30078 | Positions (NIP-78) | Yes | User | Implemented |

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
  ["status", "open" | "archived"]
  ["t", "<topic-hashtag>"]      # repeatable
```

**Key rules:**
- Kind 982 only. Not kind 30000. Not any replaceable kind.
- Non-replaceable — immutable once published. Do not use a replaceable kind.
- Only `E` tags for references (e.g., linking to related markets). Never `A` tags.
- No `version: 1` tag.
- No expiry tags. Markets never expire.
- `created_at` is the market's open timestamp.
- There is no resolution state. Markets do not close or resolve.

**The `d` tag (slug):**
The slug is the stable, URL-safe identifier for the market. It's used in routing (`/market/[slug]`). It must be unique per creator pubkey.

**The `content` field:**
Full markdown. This is the market's written argument — the thesis, evidence, sources, and rationale. Displayed prominently on the market page.

---

## Kind 983 — Trade Record _(planned / in-progress)_

> **Status:** Not yet wired end-to-end. The event schema is defined but the mint does not currently publish kind 983 events after each trade. Treat this as the intended design.

Published by the **mint** after every trade. This is the public audit log of all trading activity.

```
kind: 983
pubkey: <mint's pubkey>
content: ""
tags:
  ["e", "<kind-982-market-event-id>"]
  ["p", "<nostr-pubkey>"]      # optional; only when trade request used NIP-98
  ["amount", "<base units>"]
  ["unit", "<currency unit, launch uses 'usd'>"]
  ["direction", "yes" | "no"]
  ["type", "buy" | "sell"]
  ["price", "<ppm>"]
```

**Field notes:**

- **`pubkey`**: The mint's own Nostr pubkey — not the trader's pubkey
- **`p`**: Optional request-signer pubkey. Only present when the mint validated NIP-98 on the trade request.
- **`direction`**: `"yes"` = LONG side, `"no"` = SHORT side
- **`type`**: `"buy"` = tokens minted (user bought shares, market cap grew). `"sell"` = tokens burned (user sold shares, market cap contracts).
- **`price`**: Parts per million (ppm), where 0 = 0% and 1000000 = 100%. Example: `500000` = 50%, `720000` = 72%.
- **`amount`**: The product-facing trade notional in the unit's base units. For launch, `unit=usd` means the amount is stored in USD minor units even though execution settles behind the scenes through Lightning.

If `p` is absent, the trade is intentionally anonymous. If `p` is present, it means the Nostr pubkey that signed the HTTP request, not a permanent proof owner across future swaps. See `docs/mint/auth.md`.

**Purpose:**
Kind 983 events let anyone reconstruct the trading history of any market. They're the audit log — the source of truth is the mint's database, but kind 983 provides public verifiability.

---

## Kind 1111 — Discussions (NIP-22)

Standard NIP-22 threaded comments with Cascade-specific extensions. Used for market discussions, creator clarifications, and analysis posts.

**Top-level market post:**
```
kind: 1111
pubkey: <author's pubkey>
content: "<comment text>"
tags:
  ["e", "<kind-982-market-event-id>", "<relay>", "root"]
  ["k", "982"]                  # kind of the root event (Cascade-specific)
  ["p", "<market-creator-pubkey>"]
  ["stance", "<bull|bear|neutral>"]   # author's position stance (Cascade-specific)
  ["type", "<analysis|question|update>"]  # post type (Cascade-specific)
  ["subject", "<post title>"]   # Cascade-specific
```

**Reply to an existing comment:**
```
kind: 1111
pubkey: <author's pubkey>
content: "<reply text>"
tags:
  ["e", "<root-event-id>", "", "root"]
  ["e", "<parent-event-id>", "", "reply"]
  ["k", "1111"]                 # kind of the parent event
  ["p", "<parent-author-pubkey>"]
```

Cascade adds `k`, `stance`, `type`, and `subject` tags beyond the base NIP-22 spec. See `src/services/nostrService.ts` for the authoritative implementation.

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
content: <JSON-stringified position object>
tags:
  ["d", "cascade:position:<marketId>:<direction>"]
  ["c", "cascade"]
  ["v", "1"]
```

**Notes:**
- Content is JSON (not empty string) — the full position object is serialized as the event content
- Tags use a `d/c/v` pattern: `d` for identity, `c` for application namespace, `v` for version
- `direction` values in the d-tag: `"yes"` (LONG) or `"no"` (SHORT) — lowercase
- Replaceable by d-tag: each (user, market, direction) has exactly one position record
- Last-write-wins — no concurrency issues since each user writes their own positions
- User-signed: the user's private key signs these events, not the mint

**Future:**
Positions may eventually be derived from kind 983 trade events rather than stored as kind 30078. The Cashu bearer model means the mint doesn't know who holds what — kind 30078 is a user-side record. If users start trading on multiple devices or via agents, kind 30078 becomes the authoritative position record.

---
