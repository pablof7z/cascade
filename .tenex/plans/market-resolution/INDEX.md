# Market Resolution Mechanism

## Context

Cascade is a prediction-market platform on Nostr. Markets are created as kind:30000 events and traded via an LMSR cost function. The codebase already has:

- **`marketService.ts`** — Parses kind:30000 events into `Market` objects, subscribes to relay updates, enriches with trading data.
- **`resolutionService.ts`** — Skeleton with `resolveMarket()`, `handleResolutionEvent()`, `getResolutionEvent()`, `fetchPositions()`. Payout calculation is stubbed.
- **`vaultStore.ts`** — Cashu wallet wrapper with `getVaultBalance()`, `getProofs()`, `addProofs()`, `removeProofs()`. **Global balance only** — no per-market reserve tracking (per-market accounting is a Phase 2 enhancement).
- **`tradingService.ts`** — LMSR math: `calcCost()`, `calcShares()`, `getPrice()`. When a user buys shares, their sats enter the vault as Cashu proofs via the LMSR cost function. The vault accumulates all trading proceeds.
- **`positionService.ts`** — Fetches kind:30078 position events by pubkey, with `fetchPositions(ndk, pubkey)`.
- **`nostrService.ts`** — `publishEvent()`, `fetchEvents()`, `subscribeToEvents()` via NDK.
- **UI pages** — Market detail page (`/m/[slug]/+page.svelte`), mock profile page, existing tab/banner patterns.

**Vault Funding Model**: When users buy shares, sats flow through the LMSR cost function and are deposited into the vault as Cashu proofs. The vault holds the aggregate of all trading proceeds across all markets. On resolution, winning payouts are drawn from this global vault balance. Losing stakes are not explicitly moved — they were absorbed by the LMSR cost function during trading and already reside in the vault. This means the vault balance should always cover all outstanding winning obligations if the LMSR math is correct, but the pre-check exists as a safety net.

**What's missing**: No Nostr event type for resolution, no payout distribution, no resolution UI, no queue/deduplication, no multi-tab safety, no partial-failure recovery.

## Approach

Wire the existing pieces together with a **replaceable kind:984 Nostr event** for resolution, a **queue-based payout pipeline** with deduplication and multi-tab locking, and a **modal-driven creator UI**.

Key design decisions:
1. **Replaceable kind:984** — Resolution events use a `d` tag (`['d', marketSlug]`) making them NIP-01 replaceable. Only the latest event by `created_at` for the same author+kind+d-tag wins. This allows creators to correct a resolution if they publish the wrong outcome, which is critical for financial market integrity.
2. **Sequential payout queue** — One resolution at a time per tab, with cross-tab localStorage locks and per-market deduplication to prevent double-processing.
3. **Partial-failure recovery** — TX entries track individual payout states (pending→sent→failed). Market stays 'active' until all payouts succeed. Retry resumes from where it left off.
4. **Three outcomes** — YES, NO, and VOID. VOID refunds all positions at cost basis (minus rake).

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Tag on existing kind:30000 (market event) | Conflates market definition with resolution state; breaks NIP-33 conventions |
| Non-replaceable kind:984 (immutable) | Creator can't correct wrong outcome; if YES propagates before intended NO, financial damage results |
| Time-based auto-expiry | Prediction markets need human judgment for outcome; auto-expiry doesn't determine who won |
| Per-market vault reserve tracking | Correct long-term but over-engineered for MVP; global vault balance with pre-checks is sufficient |

## Section Overview

| File | Scope |
|---|---|
| `nostr-event-design.md` | Kind:984 schema, tags, replaceability, relay filters, validation |
| `service-layer.md` | Resolution service, queue, dedup, multi-tab locks, caching, token verification |
| `payout-logic.md` | LMSR payout math, winner determination, partial-failure state machine, VOID outcome |
| `ui-flow.md` | Creator modal, resolution banner, payout display, VOID support |
| `testing.md` | Unit tests, integration tests, edge cases, new feature coverage |

## Cross-Section Dependencies

1. `nostr-event-design.md` first — defines the event schema everything else depends on
2. `service-layer.md` second — implements the resolution pipeline
3. `payout-logic.md` third — depends on service-layer types and vault interaction
4. `ui-flow.md` fourth — depends on service-layer API and payout types
5. `testing.md` last — tests all of the above

## Verification

After full implementation:

```bash
# Type-check
npx tsc --noEmit

# Run all tests
npm test

# Lint
npm run lint
```

Manual checks:
- Creator resolves market YES → banner shows "Resolved: YES", trading disabled, winners see payout
- Creator resolves market NO → same flow, opposite winners
- Creator resolves market VOID → all positions refunded at cost basis minus rake
- Double-click resolve → only one resolution processes (dedup)
- Open two tabs, resolve same market → second tab gets "Another tab is resolving" error
- Partial payout failure → market stays active, retry resumes from last successful payout
- Creator changes mind → publishes new kind:984, latest replaces previous
