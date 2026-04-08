# Cascade — Nostr Event Kinds

*Status: Working Draft — 2026-04-02*
*Supersedes: ad-hoc kind 30000 / kind 1 usage in current codebase*

---

## Overview

Cascade uses Nostr events as its canonical data layer. This document defines the authoritative kind structure for all Cascade events.

**Design Principles:**
- Markets are **immutable commitments** — non-replaceable once published
- Trades are **mint-authoritative** — only our mint can issue trade records
- Discussions use **NIP-22** for proper threading
- Bookmarks use **NIP-51** standard lists
- Positions remain replaceable (user-exclusive, last-write-wins)

---

## Kind Map

| Kind | Description | Replaceable? | Publisher |
|------|-------------|--------------|-----------|
| `982` | Market (thesis/module definition) | **No** | User |
| `983` | Trade record | **No** | Mint |
| `984` | Market resolution addendum | **No** | Oracle/Mint |
| `1111` | Comments / discussions (NIP-22) | No | User |
| `10003` | Bookmarks list (NIP-51) | Yes (kind 10xxx) | User |
| `30078` | Positions (NIP-78, current) | Yes (kind 30xxx) | User |

---

## Kind 982 — Market Definition

Non-replaceable. A market's thesis is a **commitment** — it cannot be edited after publication. Addenda go as NIP-22 comments referencing this event.

### Fields

```
kind: 982
content: <markdown body — the market's full written case>
tags:
  ["title", "<human-readable market title>"]
  ["d", "<slug — URL-safe identifier>"]
  ["c", "<category>"]                    # repeatable; e.g. "crypto", "politics"
  ["description", "<one-liner summary>"]
  ["status", "open" | "resolved" | "archived"]
  ["t", "<topic-tag>"]                   # repeatable; freeform hashtags
```

### Notes
- `created_at` timestamps the market's opening — immutable
- Resolution state is NOT stored here (can't update) — see kind 984
- `d` tag forms the slug: `cascade:{d}` convention recommended

### Migration
Current kind `30000` markets: tombstone with kind-5 delete, republish as kind 982.

---

## Kind 983 — Trade Record

Non-replaceable. Published exclusively by **the Cascade mint** (our server keypair) to prevent fake trade events. Canonical audit trail for all position-taking.

### Fields

```
kind: 983
content: ""                              # empty or JSON metadata
tags:
  ["e", "<market-event-id>"]            # references kind 982 market
  ["p", "<trader-pubkey>"]              # who made the trade
  ["amount", "<sats>"]
  ["side", "LONG" | "SHORT"]
  ["price", "<probability at trade time, 0-1>"]
  ["position_id", "<uuid>"]
  ["mint", "<mint-pubkey>"]
```

### Notes
- Since trades are mint-signed and non-replaceable, positions *could eventually* be derived purely from these events — allowing deprecation of kind 30078.
- Mint keypair must be kept server-side and never exposed.

---

## Kind 984 — Market Resolution

Non-replaceable addendum event published when a market resolves. References the original kind 982 event.

### Fields

```
kind: 984
content: "<resolution rationale / explanation>"
tags:
  ["e", "<kind-982-market-event-id>"]   # the market being resolved
  ["resolution", "YES" | "NO"]
  ["resolved_at", "<unix timestamp>"]
  ["oracle", "<pubkey of resolver>"]
```

### Notes
- Published by market creator OR our oracle service
- Keeps the original kind 982 immutable while putting resolution on-chain
- Payout processing reads this event to trigger Cashu distribution

---

## Kind 1111 — Comments / Discussions (NIP-22)

Standard NIP-22 comment events. Use for:
- Market discussions
- Creator addenda/clarifications (replies to their own kind 982)
- User reactions and debate

### Fields (per NIP-22)
```
kind: 1111
content: "<comment text>"
tags:
  ["A", "<kind:pubkey:d-tag>", "<relay>", "root"]   # market being discussed
  ["K", "982"]                                        # root kind
  ["p", "<market-creator-pubkey>"]
  # For replies:
  ["e", "<parent-comment-id>", "<relay>", "reply"]
  ["k", "1111"]
```

### Migration
Current kind `1` + `#m` tag discussions: migrate to kind 1111 with proper NIP-22 A-tag referencing kind 982 markets.

---

## Kind 10003 — Bookmarks (NIP-51)

Standard NIP-51 replaceable bookmarks list. Replaces current localStorage-only bookmark storage.

```
kind: 10003
content: ""
tags:
  ["e", "<market-event-id>"]            # bookmarked market; repeatable
```

### Alternative
If per-app namespace is important: use kind `30003` with `d` tag `cascade:bookmarks`. Prefer `10003` unless conflicts arise.

---

## Kind 30078 — Positions (NIP-78, current)

User-signed replaceable events. Each position is a separate addressable event. Last-write-wins; no concurrency issues (user-exclusive).

```
kind: 30078
tags:
  ["d", "cascade:position:<marketId>:<direction>"]
  ["market", "<marketId>"]
  ["direction", "YES" | "NO"]
  ["amount", "<sats-committed>"]
  ["shares", "<shares-held>"]
  ["avg_price", "<average-purchase-price>"]
```

### Future
Long-term: positions could be *derived* from kind 983 trade events rather than stored separately. Kind 30078 may be deprecated once trade event sourcing is implemented.

---

## Migration Plan

### Phase 1 (Now → MVP)
- New markets: publish as kind 982 (non-replaceable)
- Keep reading kind 30000 markets for backwards compatibility
- Kind 30078 positions: keep as-is

### Phase 2 (Post-MVP)
- Tombstone all kind 30000 markets via kind-5 delete
- Republish as kind 982
- Migrate discussions to NIP-22 kind 1111
- Wire bookmarks to kind 10003 (NIP-51)

### Phase 3 (Scaling)
- Trade event sourcing from kind 983
- Deprecate kind 30078 positions
- Full audit trail from on-chain trade events

---

## Open Questions

1. **Kind numbers** — 982/983/984 are made-up. Should we register them as a NIP or just use them as app-specific kinds? (Nostr convention: kinds 10000-19999 for replaceable non-addressable, 30000+ for addressable, 1000-9999 for non-replaceable. 982 fits the non-replaceable range.)

2. **Mint keypair management** — Where does the mint signing keypair live in production? Server env var, HSM, or Cashu mint's built-in keypair?

3. **Oracle identity** — Same keypair as mint, or separate? Separate is cleaner (separation of concerns).
