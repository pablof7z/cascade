# Nostr Event Design — Kind:984 Resolution Event

## Schema

```json
{
  "kind": 984,
  "pubkey": "<market-creator-hex-pubkey>",
  "created_at": 1714000000,
  "tags": [
    ["e", "<market-event-id-hex>"],
    ["d", "<market-slug>"],
    ["resolution", "YES"],
    ["resolved_at", "1714000000"],
    ["oracle", "<resolver-pubkey-hex>"],
    ["p", "<resolver-pubkey-hex>", "", "oracle"],
    ["c", "cascade"]
  ],
  "content": "Optional creator note explaining the resolution rationale",
  "sig": "..."
}
```

### Tags Reference

| Tag | Indexed | Purpose | Values |
|---|---|---|---|
| `e` | ✅ Yes | Links to market event | Market event ID hex |
| `d` | ✅ Yes | Makes event replaceable (NIP-01) | Market slug string |
| `resolution` | ❌ No | Outcome value | `YES`, `NO`, `VOID` |
| `resolved_at` | ❌ No | Timestamp of resolution (record-keeping) | Unix timestamp string |
| `oracle` | ❌ No | Human-readable resolver reference | Resolver pubkey hex |
| `p` | ✅ Yes | Indexed resolver pubkey for relay queries | Resolver pubkey hex, role marker `oracle` |
| `c` | ✅ Yes | App namespace filter | `cascade` |

> **Note on multi-character tags**: `resolution`, `resolved_at`, and `oracle` are NOT indexed by NIP-01 relays. You cannot filter on these server-side (e.g. `{ '#resolution': ['YES'] }` will not work). All filtering by outcome value must be done client-side after fetching by indexed tags. For MVP this is acceptable since primary discovery uses the indexed `#e` tag. If relay-side outcome filtering becomes needed in the future, add a single-letter tag like `['o', 'YES']`.

## Replaceability

Kind:984 uses a `d` tag to make it **NIP-01 replaceable** (same semantics as parameterized replaceable events). For the same author (`pubkey`) + kind (`984`) + `d` tag value (`marketSlug`):

- **Only the event with the latest `created_at` is canonical**
- Relays SHOULD store only the latest version
- Clients MUST prefer the latest `created_at` when multiple events exist

This enables a critical safety feature: **the market creator can correct a resolution**. If they accidentally publish `resolution=YES` but meant `NO`, they publish a new kind:984 with the same `d` tag and the correct outcome. The newer event supersedes the older one.

### Why Replaceable Over Immutable

1. **Financial safety** — Wrong resolution = wrong payouts. Creator must be able to fix mistakes before payouts execute.
2. **Relay consistency** — Immutable events with conflicting outcomes create ambiguity across relays. Replaceability gives a deterministic "latest wins" rule.
3. **NIP-01 native** — No custom protocol needed; relays already implement replaceable event semantics.

### Resolution Finality

The resolution is considered **final for payout purposes** at the moment the local client's `resolutionService` processes it and begins the payout queue. Once payouts start executing, changing the resolution event on the relay does NOT reverse already-sent payouts. The TX log records which resolution event ID triggered each payout for auditability.

## Validation Rules

The client MUST validate before accepting a kind:984:

1. **Author match** — `event.pubkey` must equal the market creator's pubkey (only the creator can resolve their own market)
2. **Market reference** — `e` tag must reference a valid, known market event ID
3. **Outcome value** — `resolution` tag must be one of: `YES`, `NO`, `VOID`
4. **Not deleted** — Check for NIP-09 deletion event (kind:5) targeting the market event. If the market has been deleted, reject the resolution with error: "Cannot resolve a deleted market"
5. **Signature** — Standard Nostr signature verification (handled by NDK)

## Relay Behavior

### Discovery Filters

```typescript
// Primary: Find resolution for a specific market
{ kinds: [984], '#e': [marketEventId], '#d': [marketSlug] }

// By resolver: Find all resolutions by a specific oracle
{ kinds: [984], '#p': [oraclePubkey] }

// App-wide: All Cascade resolution events
{ kinds: [984], '#c': ['cascade'] }
```

### Conflict Resolution

When multiple kind:984 events exist for the same market:

1. **Same author, same `d` tag** → Latest `created_at` wins (NIP-01 replaceable semantics)
2. **Different authors** → Only the market creator's event is valid (validation rule #1 rejects others)
3. **On tie** → Accept the first valid event received by the client; ignore subsequent events for the same market. Do NOT use `created_at` as a tiebreaker (it can be backdated). `resolved_at` tag is for record-keeping only, not ordering.

## File Changes

### `src/lib/constants/nostr-kinds.ts`
- **Action**: modify
- **What**: Add `RESOLUTION_EVENT_KIND = 984` constant
- **Why**: Centralize kind number for type safety and discoverability

### `src/lib/types/market.ts`
- **Action**: modify
- **What**: Add `ResolutionEvent` type with fields: `eventId`, `marketEventId`, `marketSlug`, `outcome` (`'YES' | 'NO' | 'VOID'`), `resolvedAt`, `oraclePubkey`, `content`, `createdAt`
- **Why**: Typed representation of parsed kind:984

## Execution Order

1. **Add kind constant** — Add `RESOLUTION_EVENT_KIND = 984` to `nostr-kinds.ts`. Verify: `grep RESOLUTION_EVENT_KIND src/lib/constants/nostr-kinds.ts` returns the line.
2. **Add `ResolutionEvent` type** — Add the type to `market.ts`. Verify: `npx tsc --noEmit` passes.
