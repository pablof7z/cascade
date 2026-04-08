# Lightning Backend — Selection & Graduation Path

## Available Backends in CDK

The CDK mint at `/cdk-mintd/` supports five Lightning backends via its pluggable `MintLightning` trait. Each backend implements `pay_invoice()`, `create_invoice()`, `get_balance()`, and `check_invoice_status()`.

### Backend Comparison Matrix

| Backend | Self-Custody | Channel Mgmt | Infra Requirements | Routing Fees | Best For |
|---|---|---|---|---|---|
| **Phoenixd** | Yes (keys on server) | Automatic (ACINQ nodes) | Minimal (~512MB RAM) | ~0.4% + 4 sat base (ACINQ fee) + ~0.1% routing | **Launch phase** — zero channel management |
| **LND** | Yes (keys on server) | Manual / scripted | Heavy (4+ CPU, 16GB RAM, 500GB SSD) | ~0.1-0.3% routing only | **Growth phase** — full control, lowest routing cost |
| **CLN** | Yes (keys on server) | Manual / plugin-assisted | Heavy (similar to LND) | ~0.1-0.3% routing only | Alternative to LND if CLN expertise exists |
| **LNbits** | Depends on host | Delegated to host | Minimal (API client only) | Host fees + routing | Quick testing, not recommended for production custody |
| **Strike** | No (custodial) | N/A | None (API client only) | ~0.3% + flat fee | US-regulated compliance path |

## Recommended Path: Phoenixd → LND

### Phase 1: Phoenixd (Launch → ~$50K monthly volume)

**Why Phoenixd for launch:**
- Zero channel management — ACINQ handles liquidity automatically
- Minimal infrastructure — runs alongside mint on a single server
- Self-custodial — keys stay on the mint server
- Fast setup — binary download, single config file, ready in minutes
- Predictable costs — ACINQ's fee is transparent and fixed

**Phoenixd cost structure:**
- Mining fee for channel opens: ~2,000-10,000 sats per channel (amortized over channel lifetime)
- ACINQ service fee: 0.4% + 4 sat base per payment
- Network routing: ~0.1% additional

**Phoenixd limitations that trigger graduation:**
- Single channel with ACINQ — bottleneck at high volume
- Higher per-payment fees than self-managed channels at scale
- No multi-path payment support
- Channel capacity limited by ACINQ's liquidity allocation
- No ability to earn routing fees

**Configuration in CDK:**

```toml
[ln]
ln_backend = "phoenixd"

[phoenixd]
api_url = "http://127.0.0.1:9740"
api_password = "<phoenixd-api-password>"
# Fee budget — reject payments where routing fee exceeds this percentage
max_fee_percent = 1.0
```

### Phase 2: LND (>$50K monthly volume)

**Graduation triggers (any one):**
1. Monthly payment volume exceeds $50K (Phoenixd fees exceed $200/mo — cheaper to run LND)
2. Single-channel bottleneck causes payment failures >2% of the time
3. Need for multi-path payments or larger single payments (>$1,000)
4. Want to earn routing fees as supplementary revenue

**Why LND over CLN:**
- Larger ecosystem of management tools (ThunderHub, RTL, LiT)
- Better channel autopilot options (Pool, Lightning Terminal)
- More liquidity marketplace integrations (Magma, Pool, Amboss)
- Broader community support and documentation

**LND setup requirements:**
- Dedicated server or separate process on upgraded server
- Bitcoin Core pruned node (optional but recommended for sovereignty) — OR Neutrino mode for lighter footprint
- Initial channel liquidity: $5,000-20,000 worth of BTC across 5-10 channels
- Channel partners: major routing nodes (ACINQ, Kraken, Bitfinex, CoinGate, well-connected routing nodes)

**Configuration in CDK:**

```toml
[ln]
ln_backend = "lnd"

[lnd]
address = "https://127.0.0.1:8080"
cert_file = "/path/to/tls.cert"
macaroon_file = "/path/to/admin.macaroon"
```

**Channel management strategy:**
- Use Lightning Terminal (LiT) for channel scoring and rebalancing
- Set up automated rebalancing via `bos` (Balance of Satoshis) or `charge-lnd`
- Monitor channel balance with 30/70 threshold alerts (rebalance when <30% or >70% on either side)
- Open channels with 3-5 well-connected routing nodes for redundancy
- Keep 20% of total capacity as unallocated for organic channel opens

### Migration Process: Phoenixd → LND

The migration is a config change plus a brief maintenance window:

1. **Pre-migration** (no downtime):
   - Set up LND on upgraded server, sync chain, open channels, verify payments work
   - Run LND in shadow mode (test payments, verify routing) for 1 week
   
2. **Migration window** (~30 minutes):
   - Announce maintenance window to users (in-app notification, Nostr post)
   - Stop accepting new mint/melt requests (set mint to read-only mode)
   - Wait for all pending Lightning payments to settle or timeout
   - Update CDK config: change `ln_backend = "phoenixd"` to `ln_backend = "lnd"`
   - Restart CDK mint
   - Verify: create test invoice, pay it, check mint balance

3. **Post-migration**:
   - Monitor payment success rates for 24 hours
   - Keep Phoenixd running for 1 week as rollback option
   - Close Phoenixd channels once confident (funds return to on-chain wallet)

## Strike as Compliance Layer (Optional)

If regulatory pressure requires a US-regulated path:

- Strike can serve as a **secondary backend** for US-based users
- Route US-originated payments through Strike (KYC handled by Strike)
- Non-US users continue using the self-hosted Phoenixd/LND backend
- Requires per-user routing logic in the mint (not natively supported by CDK — would need custom middleware)

**Decision: Defer Strike integration until regulatory clarity is needed.**

## Execution Order

1. **Install Phoenixd** — Download binary, generate seed, start daemon
2. **Configure CDK** — Set `ln_backend = "phoenixd"` in mint config, point to Phoenixd API
3. **Fund Phoenixd** — Send initial on-chain BTC for channel opening (recommend 500K-1M sats)
4. **Test payment cycle** — Create invoice via mint, pay from external wallet, verify token issuance
5. **Test melt cycle** — Melt tokens to external Lightning invoice, verify settlement
6. **Monitor fee rates** — Track Phoenixd fees weekly, log to determine graduation trigger point
7. **Prepare LND** (when approaching graduation triggers) — Begin LND setup on separate server/process
