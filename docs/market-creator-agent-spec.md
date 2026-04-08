# Market-Creator Agent — Specification

*Status: DRAFT — Pending Cashu Phase 2 implementation*
*Agent type confirmed by Pablo (2026-04-04)*
*API Surface confirmed by human-replica design discussion (conv: d7670a6652cea920b6)*

---

## Overview

The market-creator agent is a specialized autonomous agent that identifies emerging events, creates prediction markets around them, seeds initial liquidity, and manages resolution. It is the primary mechanism for growing Cascade's market coverage proactively.

**Core value prop:** "Cascade doesn't wait for users to ask — it already has markets on tomorrow's headlines."

---

## Agent Type

**Name:** `market-creator`
**Role:** Autonomous event monitor and market architect
**Use Criteria:** Use for: seeding new markets from structured data sources, monitoring feeds, autonomous market lifecycle management. Do NOT use for general trading or portfolio management.

---

## High-Level API Surface (3 Buckets)

### 1. Market Data (read-only)
- `list_markets(filters?)` — query markets by status, category, tags, date range
- `get_market(id)` — full market detail: question, description, current prices, volume, resolution date, creator
- `get_market_discussions(id)` — discussion threads (kind 1111) for a market
- `get_leaderboard(type?)` — top predictors, top creators, most accurate

### 2. Trading & Prediction (write)
- `create_market(input)` — create a new market (kind 982, NIP-33)
- `place_trade(marketId, direction, amount)` — place a YES/NO trade
- `resolve_market(marketId, outcome)` — resolve a market as creator (status: CLOSED)

### 3. Portfolio & Wallet (read/write)
- `get_positions()` — own positions across all markets
- `get_pnl()` — realized + unrealized P&L
- `deposit(amount)` — Cashu mint deposit
- `withdraw(amount)` — Lightning withdrawal

---

## Agent Behavior

### Monitoring Loop
The agent continuously monitors structured data sources:
1. **RSS feeds** — configurable list of news sources
2. **Nostr** — kind 1 posts from followed pubkeys, keyword alerts
3. **Manual triggers** — user-defined keywords or phrases

### Market Creation Logic
When a signal is detected:
1. **Evaluate novelty** — check existing markets to avoid duplicates
2. **Assess suitability** — is this binary? Is it resolvable? Is it timely?
3. **Draft market question** — convert event headline to clear YES/NO question
4. **Set parameters** — resolution date, initial liquidity, category tags
5. **Publish** — create market via `create_market()`

### Liquidity Seeding
After creating a market, the agent seeds initial liquidity:
- Place small YES and NO trades to establish initial prices
- Target: 40-60% range (not too confident, not 50/50)
- Amount: configurable per market type

### Resolution
The agent monitors resolution-ready markets:
- Check resolution date has passed
- Fetch external source for outcome
- Call `resolve_market()` with outcome

---

## Implementation Dependencies

- **Cashu Phase 2** must be complete before agent can deposit/withdraw
- Mint endpoint URLs required for `deposit()` and `withdraw()`
- LMSR math library required for `place_trade()`
- Nostr kind 982 market creation requires `nostrService`

## Next Steps

1. Complete Cashu Phase 2 (mint-engineer → implementation)
2. Build REST API endpoints matching 3-bucket surface
3. Create market-creator agent identity
4. Implement monitoring loop (RSS → Nostr)
5. Implement market creation pipeline
6. Implement resolution pipeline
7. Seed 10 markets, evaluate accuracy
