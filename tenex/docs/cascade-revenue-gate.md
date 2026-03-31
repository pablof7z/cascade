# Cascade — Path to First Dollar

> Critical path analysis: what must be built before Cascade can generate revenue.

**Tags:** #cascade #revenue #critical-path #payments

---

# Cascade — Path to First Dollar

**Written:** 2026-03-28
**Question:** What's blocking revenue?

---

## The Revenue Model

Cascade earns money through **trading rake** — 2% fee on winning payouts.

User bets 100, wins 200, we take 4, user gets 196.

Simple. But it requires infrastructure we don't have.

---

## Critical Path to First Dollar

```
[Backend Persistence] → [Cashu Integration] → [Rake Implementation] → $1
```

Each step depends on the previous. No shortcuts.

### Gate 1: Backend Persistence
**Current state:** localStorage only. Each browser is isolated. Clear cache = lose everything.

**Required:**
- Database (user accounts, positions, balances)
- API layer (frontend talks to backend, not localStorage)
- Authentication (know who the user is across sessions)

**Without this:** Can't track who owes what. Can't collect rake. Can't operate.

**Estimated effort:** 2-3 weeks

### Gate 2: Cashu Integration
**Current state:** Types exist. Minting quotes marked `PAID` instantly. Zero actual mint interaction.

**Required:**
- Connect to a Cashu mint (self-hosted Nutshell or external)
- Deposit flow: User sends Lightning → receives Cashu tokens
- Balance tracking in backend
- Withdrawal flow: Cashu tokens → Lightning

**Without this:** No real money in the system. Nothing to rake.

**Estimated effort:** 2-3 weeks

### Gate 3: Rake Implementation
**Current state:** Not implemented.

**Required:**
- On winning payout, calculate 2% fee
- Deduct from user's winnings
- Credit to platform account
- Audit trail for accounting

**Without this:** Money flows but we capture none of it.

**Estimated effort:** 1 week (once Gates 1-2 are done)

---

## Total Time to First Dollar

**Optimistic:** 5 weeks (everything goes smoothly)
**Realistic:** 8 weeks (issues, iterations, testing)
**Conservative:** 12 weeks (architecture pivots, integration problems)

**Target date:** May 31, 2026

---

## Dependencies and Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Cashu mint reliability | External dependency | Self-host for control |
| Lightning connectivity | Payment failures | Multiple funding options |
| Backend architecture | Wrong choice slows everything | Decide fast, iterate |
| Legal/regulatory | Can't accept real money | Start small, non-US users |

---

## First Dollar Scenario

1. User connects with Nostr login
2. User deposits $10 via Lightning
3. User receives Cashu tokens (balance: $10)
4. User bets $5 on "GPT-5 releases before July 2026" YES
5. Market resolves YES
6. User wins $8.50 (before rake)
7. Platform takes $0.17 (2% of winnings)
8. User receives $8.33
9. User withdraws remaining balance via Lightning

**Platform revenue from this transaction: $0.17**

---

## What We're NOT Blocked On

- LMSR pricing: Works
- Trading UI: Works
- Market creation: Works
- Domain/hosting: Works
- Nostr integration: Nice-to-have, not blocking revenue

Focus on Gates 1-3. Everything else is secondary until money flows.
