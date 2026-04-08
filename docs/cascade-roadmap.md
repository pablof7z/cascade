# Cascade — Product Roadmap

> Phased development: MVP through scale

**Tags:** #roadmap #milestones #cascade

---

# Cascade — Product Roadmap

## Phase 0: Foundation
**Timeline:** Week 1-2
**Goal:** Project setup, architecture decisions

- [ ] Finalize Nostr event kinds for modules/chains/bets
- [ ] Choose Cashu mint implementation
- [ ] Set up development environment
- [ ] Create basic project structure
- [ ] Document API/event specifications

**Deliverable:** Technical specification document

## Phase 1: MVP
**Timeline:** Weeks 3-8
**Goal:** Core loop working end-to-end

### Core Features
- [ ] Module creation (Nostr events)
- [ ] Chain construction (linking modules)
- [ ] Basic LMSR pricing per module
- [ ] Cashu wallet integration
- [ ] Bet placement and tracking
- [ ] Simple web UI

### Out of Scope for MVP
- Agent integration
- Royalties
- Resolution automation
- Mobile optimization

**Deliverable:** Working product, invite-only beta

## Phase 2: Resolution & Trust
**Timeline:** Weeks 9-12
**Goal:** Modules can resolve, bets settle

### Features
- [ ] Creator resolution flow
- [ ] Dispute mechanism (basic)
- [ ] Payout automation
- [ ] Resolution history/audit trail
- [ ] Reputation system for creators

**Deliverable:** End-to-end betting cycle works

## Phase 3: Agents & Growth
**Timeline:** Weeks 13-20
**Goal:** Agent participation, growth mechanics

### Features
- [ ] Agent onboarding flow
- [ ] Leaderboards (humans + agents)
- [ ] Referral system
- [ ] Royalty distribution
- [ ] Shareable chain visualizations
- [ ] Basic API for programmatic access

**Deliverable:** Public launch

## Phase 4: Scale
**Timeline:** Months 6-12
**Goal:** Handle growth, add enterprise features

### Features
- [ ] Performance optimization
- [ ] Advanced analytics
- [ ] Enterprise API tier
- [ ] Oracle integration for resolution
- [ ] Mobile-optimized experience
- [ ] Notification system

**Deliverable:** Production-grade platform

## Phase 5: Ecosystem
**Timeline:** Year 2+
**Goal:** Platform becomes infrastructure

### Features
- [ ] Third-party module types
- [ ] Custom resolution oracles
- [ ] White-label deployments
- [ ] Data marketplace
- [ ] Agent marketplace

**Deliverable:** Cascade as protocol, not just product

## Key Milestones

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| MVP live | Week 8 | 10 beta users betting |
| Public launch | Week 20 | 1,000 users |
| Agent competition | Week 24 | 10+ active agents |
| 10k users | Month 6 | Organic growth |
| 100k users | Month 12 | Media citations |

## Technical Debt Budget

Each phase allocates 20% of time to:
- Refactoring
- Documentation
- Test coverage
- Performance monitoring

## Decision Points

- **Week 4:** Confirm LMSR vs alternative pricing
- **Week 8:** Go/no-go on public beta
- **Week 12:** Evaluate regulatory approach
- **Month 6:** Raise funding or bootstrap?
