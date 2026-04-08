# Economics — Cost Analysis & Revenue Model

## Revenue Model: 2% Rake on Winnings

Cascade's revenue comes from a **2% rake applied to market winnings** (not on every trade). This is defined in the project's monetization strategy and implemented as the mint withholding 2% of the payout during market resolution.

### How the Rake Works

1. User buys position tokens by minting Cashu tokens (no fee at purchase)
2. Market resolves — winning positions are entitled to payout
3. Mint distributes winnings **minus 2% rake** — the withheld tokens are never issued
4. Losing positions' tokens become worthless (already represented as unspendable)

**Example:**
- Market pool: 1,000,000 sats
- User holds 10% of winning outcome → entitled to 100,000 sats
- Rake: 2,000 sats (2% of 100,000)
- User receives: 98,000 sats as Cashu tokens, redeemable via Lightning

### Revenue per Volume Tier

| Monthly Trading Volume | Total Winnings Distributed (~50% of volume) | 2% Rake Revenue | Annual Revenue |
|---|---|---|---|
| $10,000 | $5,000 | $100 | $1,200 |
| $50,000 | $25,000 | $500 | $6,000 |
| $100,000 | $50,000 | $1,000 | $12,000 |
| $500,000 | $250,000 | $5,000 | $60,000 |
| $1,000,000 | $500,000 | $10,000 | $120,000 |
| $5,000,000 | $2,500,000 | $50,000 | $600,000 |

*Note: "Total Winnings Distributed" assumes ~50% of volume goes to winning outcomes. The actual ratio depends on market structure (binary vs multi-outcome) and LMSR pricing dynamics.*

## Infrastructure Costs

### Phase 1: Phoenixd Backend (Launch)

| Component | Monthly Cost | Notes |
|---|---|---|
| VPS (4 vCPU, 8GB RAM, 200GB SSD) | $40-60 | Hetzner CX41 or equivalent |
| Domain + TLS | $1-2 | Via Let's Encrypt (free) + domain |
| Backup storage (encrypted, off-site) | $5-10 | S3-compatible or rsync to secondary |
| Monitoring (Grafana Cloud free tier) | $0 | 10K metrics, 50GB logs free |
| Phoenixd channel costs (amortized) | $5-20 | Channel opens, ~2K-10K sats each |
| **Total infrastructure** | **$51-92/mo** | |

### Phase 2: LND Backend (Growth)

| Component | Monthly Cost | Notes |
|---|---|---|
| Mint server (4 vCPU, 8GB RAM, 200GB SSD) | $40-60 | Same as Phase 1 |
| LND server (4 vCPU, 16GB RAM, 500GB NVMe) | $80-120 | Needs chain data storage |
| Bitcoin Core (if running own node) | included | Runs on LND server |
| Channel liquidity (opportunity cost) | $20-50 | ~0.5% annual on locked BTC |
| Backup storage (encrypted) | $10-20 | Larger dataset with LND |
| Monitoring (Grafana paid if needed) | $0-30 | Depends on scale |
| **Total infrastructure** | **$150-280/mo** | |

### Phase 3: High Availability (Scale)

| Component | Monthly Cost | Notes |
|---|---|---|
| Primary mint (dedicated, 8 vCPU, 32GB RAM) | $120-200 | Handles all signing |
| Hot standby mint | $120-200 | Failover, same spec |
| LND cluster (2 nodes, load balanced) | $160-240 | Redundant Lightning |
| PostgreSQL managed (primary + replica) | $50-100 | If migrated from SQLite |
| Load balancer | $10-20 | HAProxy or cloud LB |
| Monitoring + alerting (PagerDuty/OpsGenie) | $20-50 | On-call alerting |
| **Total infrastructure** | **$480-810/mo** | |

## Break-Even Analysis

### Phase 1 (Phoenixd)

- Monthly costs: ~$75/mo (midpoint)
- Revenue needed: $75/mo from 2% rake
- Required monthly winnings: $3,750
- **Required monthly trading volume: ~$7,500**

At even modest adoption (75 active users × $100/mo average volume), Phase 1 is profitable.

### Phase 2 (LND)

- Monthly costs: ~$215/mo (midpoint)
- Revenue needed: $215/mo from 2% rake
- Required monthly winnings: $10,750
- **Required monthly trading volume: ~$21,500**

### Lightning Fee Impact on Margins

Lightning fees eat into revenue. At Phoenixd rates:

| Action | Fee Rate | On $10 payment | On $100 payment |
|---|---|---|---|
| Deposit (user → mint) | 0 (user pays LN routing) | $0 | $0 |
| Withdrawal (mint → user) | ~0.5% (Phoenixd + routing) | $0.05 | $0.50 |

Deposits are free to the mint (user pays routing to reach the mint's Lightning node). Withdrawals cost ~0.5% which comes from the mint's balance. On $100K monthly volume with ~$50K in withdrawals:

- **Phoenixd withdrawal fees: ~$250/mo** (0.5% of $50K)
- **Rake revenue: ~$1,000/mo** (2% of $50K winnings)
- **Net revenue after LN fees: ~$750/mo**

This means Lightning fees consume ~25% of rake revenue at Phoenixd rates. At LND rates (~0.15% routing), fees drop to ~$75/mo, improving net margin to ~92%.

**This reinforces the graduation trigger: move to LND when Lightning fees exceed $200/mo.**

## Operator vs Third-Party Cost Comparison

### Self-Hosted Mint (Recommended)

| Cost Type | Monthly | Notes |
|---|---|---|
| Infrastructure | $75-215 | Depends on phase |
| Operator time (DevOps) | $0* | Automated via agentic framework |
| Lightning fees | $50-250 | Depends on volume and backend |
| **Total** | **$125-465** | |

*Operator time is $0 because the Cascade team/agentic framework handles operations. If hiring a dedicated operator, add $2,000-5,000/mo for a part-time SRE.*

### Third-Party Mint (e.g., Minibits Mint, community mint)

| Cost Type | Monthly | Notes |
|---|---|---|
| Infrastructure | $0 | Hosted by third party |
| Mint operator fee | 0.5-2% of volume | Varies by operator |
| Custom rake integration | Unlikely | Third-party mints don't support custom business logic |
| **Total** | **0.5-2% of volume** | Scales linearly with volume |

**At $100K/mo volume:** Third-party = $500-2,000/mo vs Self-hosted = ~$200/mo. Self-hosted is cheaper and enables the custom rake logic that is fundamental to the business model.

### Why Third-Party Mints Don't Work for Cascade

1. **No rake support** — Standard Cashu mints have no mechanism to withhold a percentage during redemption
2. **No market-aware token issuance** — Cascade needs keysets tied to market outcomes; generic mints issue fungible tokens
3. **No LMSR pricing integration** — The mint must understand Cascade's pricing model
4. **No escrow/conditional redemption** — Market resolution requires custom logic in the mint
5. **Custody risk** — Third-party operator holds all user funds; if they disappear, Cascade users lose everything

**Decision: Self-hosted mint is the only viable option for Cascade's business model.**

## Revenue Optimization Strategies

### 1. Tiered Rake (Future)
- Standard: 2% on winnings
- High-volume markets: 1.5% (attract more liquidity)
- Premium markets (curated/featured): 2.5%

### 2. Withdrawal Fee (Optional, Controversial)
- Charge 0.1% on Lightning withdrawals to offset routing costs
- Risk: Users may avoid withdrawing, reducing trust
- **Recommendation: Do NOT charge withdrawal fees at launch.** Absorb as cost of doing business.

### 3. Market Creation Fee (Future)
- Charge market creators a flat fee (e.g., 1,000 sats) to create a market
- Prevents spam markets
- Revenue is minimal but improves market quality

### 4. Float Income
- Funds sitting in the mint as unspent Cashu tokens earn nothing (BTC doesn't pay interest)
- However, Lightning channel liquidity can earn routing fees if channels are well-positioned
- Estimated: 0.5-2% annual return on deployed liquidity in routing fees

## Key Economic Assumptions

| Assumption | Value | Sensitivity |
|---|---|---|
| Rake rate | 2% | ±0.5% changes break-even by ~25% |
| Winnings as % of volume | 50% | Could range 40-60% depending on market types |
| Withdrawal rate | 50% of winnings | Some users reinvest; lower withdrawal = lower LN fees |
| Phoenixd fee rate | 0.5% | Fixed by ACINQ pricing |
| LND routing fee rate | 0.15% | Depends on channel topology |
| User growth rate | 10% month-over-month | Determines when to graduate Lightning backend |
