# Milestone 9: Signet Paper-Trading Exit Gate — Execution Plan

*Written 2026-04-13. Author: human-replica.*

## Purpose

Prove the entire Cascade product loop works in signet before any mainnet exposure. This is a **verification milestone**, not a build milestone. Everything required should already exist after round-4-m7-m8 merges.

If gaps are found during M9, they become targeted fixes — not scope creep.

## Prerequisites

- [ ] round-4-m7-m8 merged to main (creator route removed, all Review 4 findings resolved)
- [ ] Signet mint running locally or on a server accessible from the browser
- [ ] Pablo (or a second test identity) available for the "second user buys" step

## The 8-Step Scenario

These must all pass **without manual DB edits, without restarting services manually, without operator intervention**.

| Step | What happens | Verified by |
|------|-------------|-------------|
| 1 | User starts at $0 signet portfolio | `/portfolio` shows $0.00 |
| 2 | User creates a market on `/builder` | Market saved to local draft state (not API) |
| 3 | Market is creator-only pending | Only visible to creator in their builder view; not in discovery feed |
| 4 | User paper-funds portfolio balance | Stripe-simulated funding flow completes; proofs appear in browser storage under `cascade:signet:` namespace |
| 5 | User seeds the market | Market seeding succeeds; mint records seed trade |
| 6 | First mint-authored kind 983 makes it public | Market appears in signet discovery feed for any user |
| 7 | Second user/agent buys and sells against it | Trade executes; proofs move correctly; position appears in second user's portfolio |
| 8 | Activity, portfolio, market views stay coherent | All three views reflect the trades without refresh loops or stale state |

## Recovery Tests (also required for success gate)

- **Interrupted funding**: start a paper funding flow, kill the mint, restart it → funding recovers without re-requesting
- **Interrupted trade**: start a buy, kill the mint mid-execution, restart → trade either completes or is cleanly cancelled; no stuck state

## Edition Isolation Check

- All signet actions must produce zero impact on mainnet
- Verify: signet proofs stored under `cascade:signet:` namespace, not `cascade:mainnet:`
- Verify: signet and mainnet markets are served from separate mints; isolation is enforced at the Cashu network layer (different mint URLs), not via HTTP headers

## How to Run M9

**Setup note:** The signet mint runs on `http://127.0.0.1:3342` (local). The Vercel deploy at `cascade.f7z.io` is hardcoded to mainnet and cannot reach a localhost mint. M9 must be run against a **local dev server**, not the Vercel deploy.

### Setup
```bash
# 1. Confirm signet mint is running
lsof -i :3342  # should show cascade-mint process

# 2. Start the web frontend with signet config
cd $PROJECT_BASE/web
cp .env.signet.example .env.local  # or set PUBLIC_CASCADE_EDITION=signet, PUBLIC_CASCADE_MINT_URL=http://127.0.0.1:3342
npm run dev

# 3. Open http://localhost:5173 in browser
```

Delegate to `testing-team` with this plan. The verifier should:

1. Confirm signet mint is running (`lsof -i :3342`)
2. Start local dev server with signet env vars (see Setup above)
3. Open `http://localhost:5173` in browser
4. Walk through all 8 steps as a human user — no scripted shortcuts
5. Run the two recovery tests
6. Document any failure gate hits

## Success Gates (from plan)

- All 8 steps work without manual DB edits ✓
- Restart recovery works for at least one interrupted funding flow and one interrupted trade ✓
- No mainnet systems are touched during signet testing ✓

## Failure Gates (from plan)

- Paper trading requires hidden operator intervention ✗
- Edition boundaries are not operationally enforced ✗
- Proof portability or funding flows are not recoverable after restart ✗

## If M9 Fails

For each failure gate hit, create a targeted fix issue and delegate to coder. Do not start M10 until M9 passes clean.

## After M9 Passes → M10

M10 is mainnet launch. Requires:
- Real Stripe + Lightning rails (not signet)
- Mainnet LND running (IBD in progress, ETA ~12-24h from 2026-04-13 16:00 UTC)
- Operator playbook for provider outages
- Monitoring and alerting in place
- Rollback procedure documented
