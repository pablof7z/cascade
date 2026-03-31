# Cascade Roadmap — Q2 2026 to Launch

> Dated milestones from demo to revenue-generating product. 18-month success horizon starting March 2026.

**Tags:** #cascade #roadmap #milestones #2026

---

# Cascade Roadmap — Q2 2026 to Launch

**Written:** 2026-03-28
**Horizon:** 18 months (target: September 2027 sustainable business)
**Starting Point:** Demo only. Browser-based LMSR simulation. Zero infrastructure.

---

## Current State (Honest Assessment)

| Component | Status |
|-----------|--------|
| LMSR pricing engine | ✅ Working |
| Trading simulation | ✅ Works (browser-only) |
| Market creation UI | ✅ Works |
| Backend/persistence | ❌ None (localStorage only) |
| Nostr integration | ❌ Zero |
| Cashu payments | ❌ Types only, no mint |
| Market resolution | ❌ Not implemented |
| Trading rake | ❌ Not implemented |
| Authentication | ❌ OAuth buttons are stubs |
| Real agents | ❌ Only Math.random() bots |

**Bottom line:** We have a working concept demo. Everything needed for a business is missing.

---

## Phase 1: Foundation (April 2026)
**Goal:** Architecture that can support real money and real users

### Week 1-2: Backend Architecture Decision
- [ ] Choose stack: Edge functions vs traditional server vs hybrid
- [ ] Database selection: Postgres? SQLite? Nostr-as-database?
- [ ] Design data model for markets, positions, users

### Week 3-4: Core Backend Implementation
- [ ] User accounts with real authentication (Nostr login via NIP-07)
- [ ] Market persistence (no more localStorage)
- [ ] Position tracking across sessions
- [ ] Basic API for frontend

**Milestone (April 30):** Markets and positions persist. Multiple users can see same data.

---

## Phase 2: Money (May 2026)
**Goal:** Real value can flow through the system

### Week 1-2: Cashu Integration
- [ ] Choose mint: Self-hosted Nutshell vs external
- [ ] Wallet integration in frontend
- [ ] Deposit flow: Lightning → Cashu tokens
- [ ] Balance tracking

### Week 3-4: Trading with Real Stakes
- [ ] Connect trading engine to real balances
- [ ] Implement rake (2% on winning payouts)
- [ ] Transaction logging for audit trail
- [ ] Withdrawal flow: Cashu → Lightning

**Milestone (May 31):** Someone can deposit $10, bet on a market, win, and withdraw winnings minus rake.

---

## Phase 3: Resolution (June 2026)
**Goal:** Markets can close and pay out

### Week 1-2: Resolution Mechanism
- [ ] Market close trigger (manual for now)
- [ ] Payout calculation
- [ ] Token redemption flow
- [ ] Settlement to user wallets

### Week 3-4: Economic Closure Testing
- [ ] Test the "no oracle" thesis — do markets converge naturally?
- [ ] Arbitrage behavior
- [ ] Edge cases (disputed outcomes, abandoned markets)

**Milestone (June 30):** Complete betting cycle works: create → trade → resolve → payout.

---

## Phase 4: Nostr Native (July 2026)
**Goal:** Markets are Nostr events, portable and censorship-resistant

### Week 1-2: Event Kind Design
- [ ] Define kinds for modules, theses, positions
- [ ] Relay strategy
- [ ] Event validation

### Week 3-4: Migration
- [ ] Publish markets as Nostr events
- [ ] Read markets from relays
- [ ] Identity = Nostr pubkey

**Milestone (July 31):** Markets exist on Nostr. Platform is one client, not the database.

---

## Phase 5: Soft Launch (August 2026)
**Goal:** Real users, real money, real feedback

### Week 1-2: Invite-Only Beta
- [ ] 50-100 beta users
- [ ] Seed 5-10 quality markets
- [ ] Daily monitoring for issues

### Week 3-4: Iterate Based on Feedback
- [ ] UX improvements
- [ ] Bug fixes
- [ ] Performance optimization

**Milestone (August 31):** 100 users, $1,000+ in volume, first revenue from rake.

---

## Phase 6: Growth (September 2026 - March 2027)
**Goal:** Scale to 10,000 users

- Agent onboarding via SKILL.md
- Referral program
- News-driven market creation
- Leaderboards
- Mobile optimization

**Milestone (March 2027):** 10,000 users, sustainable revenue covering infrastructure costs.

---

## Phase 7: Scale (April 2027 - September 2027)
**Goal:** 100,000 users, profitable

- Enterprise features
- API access tiers
- Media amplification
- International expansion

**Milestone (September 2027):** Successful business.

---

## Key Decision Points

| Date | Decision |
|------|----------|
| April 15 | Backend architecture finalized |
| May 15 | Cashu mint choice (self-host vs external) |
| June 15 | Resolution mechanism validated |
| August 1 | Go/no-go on soft launch |
| December 2026 | Raise funding or continue bootstrapping? |

---

## Risk Mitigation

1. **Regulatory:** Start with small stakes, non-US focus, monitor legal landscape
2. **Cold start:** Seed markets ourselves, agent participation, targeted community outreach
3. **Technical:** Weekly reviews, don't skip testing, audit before real money

---

## Success Metrics by Phase

| Phase | Key Metric | Target |
|-------|-----------|--------|
| 1 | Multi-user persistence | Works |
| 2 | First real transaction | $1 |
| 3 | First complete bet cycle | 1 user |
| 4 | Markets on Nostr | 100% |
| 5 | Beta users | 100 |
| 6 | Active users | 10,000 |
| 7 | Monthly revenue | $10,000+ |
