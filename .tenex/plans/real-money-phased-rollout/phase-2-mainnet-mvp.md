# Phase 2: Mainnet MVP — Real Money Trading

## Goal

Launch the custom `cascade-mint` on mainnet Lightning with real sats. This is the moment Cascade becomes a real prediction market. The strategy is conservative: limit exposure, monitor aggressively, and have kill switches ready.

## Prerequisites

- All Phase 1 go/no-go gates passed
- LMSR validation test suite green on testnet
- Team testing period completed with no critical bugs
- Incident response runbook finalized
- Legal/compliance review completed (see blast-radius-analysis.md)

## Infrastructure — Production Grade

### Lightning Node (Mainnet)
- **Recommended**: Dedicated LND node on a VPS (e.g., Hetzner, OVH — jurisdictions with favorable crypto stance)
- **Channel capacity**: Start with 5-10M sats across 3-5 channels to well-connected routing nodes
- **Backup**: Static channel backups (SCB) to encrypted remote storage, daily
- **Monitoring**: `lndmon` or Thunderhub for channel health, balance alerts when any channel drops below 20% capacity

### Cascade-Mint Deployment
- **Host**: Same or adjacent VPS to Lightning node (low latency to LND gRPC)
- **Database**: PostgreSQL (not SQLite) for production. Daily encrypted backups.
- **TLS**: Mandatory. Let's Encrypt cert on the mint's public endpoint.
- **Rate limiting**: Per-IP and per-pubkey rate limiting on all endpoints
- **Process management**: systemd or Docker with auto-restart policies

### Hot/Warm/Cold Wallet Strategy
- **Hot wallet** (Lightning node): Only what's needed for active markets + channel rebalancing buffer. Target: 2x current total market reserves.
- **Warm wallet** (on-chain, automated): Excess funds sweep from Lightning to an on-chain wallet daily. Threshold: if Lightning balance exceeds 3x total market reserves, sweep excess.
- **Cold wallet** (manual, offline): Monthly manual sweep from warm to cold storage for long-term fee revenue. Hardware wallet or multisig.

## Exposure Limits — Conservative Launch

These limits contain the blast radius if anything goes wrong:

| Parameter | Phase 2 Launch Value | Rationale |
|---|---|---|
| Max deposit per user per day | 100,000 sats (~$60) | Limits individual loss |
| Max single trade | 50,000 sats (~$30) | Prevents whale manipulation |
| Max total exposure per market | 1,000,000 sats (~$600) | Caps mint liability per market |
| Max concurrent active markets | 10 | Limits total system exposure |
| Total system exposure cap | 10,000,000 sats (~$6,000) | Absolute maximum liability |
| Min withdrawal amount | 1,000 sats | Prevents dust attacks |
| Withdrawal daily limit per user | 500,000 sats | Anti-money-laundering basic hygiene |

All values in sats. Dollar equivalents at ~$60k/BTC for reference only.

**Limit enforcement location**: Server-side in `cascade-mint` API handlers. Frontend limits are advisory only (UX guidance); the mint is the single source of truth.

## File Changes

### `cascade-mint/crates/cascade-api/src/middleware/rate_limit.rs`
- **Action**: Create
- **What**: Rate limiting middleware for Axum. Per-IP and per-pubkey sliding window. Return 429 with Retry-After header.
- **Why**: Prevent abuse, DoS, and rapid-fire trading that could exploit race conditions.

### `cascade-mint/crates/cascade-api/src/middleware/exposure_limits.rs`
- **Action**: Create
- **What**: Middleware/service that enforces all exposure limits from the table above. Checks run before trade execution:
  - Query user's 24h deposit total → reject if over daily limit
  - Query trade amount → reject if over single-trade limit
  - Query market's total exposure → reject if market cap reached
  - Query system-wide exposure → reject if system cap reached
- **Why**: This is the primary risk containment mechanism.

### `cascade-mint/crates/cascade-core/src/config.rs`
- **Action**: Modify
- **What**: Add all exposure limit parameters as config values (env vars or config file). Defaults to the conservative launch values above. Must be changeable without redeployment (config reload or env var change + restart).
- **Why**: Limits will be adjusted as confidence grows. Must be tunable.

### `cascade-mint/crates/cascade-api/src/routes/admin.rs`
- **Action**: Create
- **What**: Admin-only endpoints (authenticated with a separate admin key):
  - `GET /admin/status` — system-wide stats: total exposure, active markets, Lightning balance, solvency check
  - `POST /admin/pause` — emergency pause: stops all new trades and deposits. Withdrawals still work.
  - `POST /admin/resume` — resume after pause
  - `POST /admin/limits` — update exposure limits at runtime
  - `GET /admin/markets/:id/audit` — detailed market audit: all trades, current positions, reserve status
- **Why**: Operational control. The pause endpoint is the kill switch.

### Frontend: Remove mock/play-money indicators
- **Action**: Modify multiple components
- **What**: 
  - Replace "CAS" currency references with "sats" where applicable
  - Update balance displays to show sat amounts
  - Add explicit "Real Money" indicator during Phase 2 beta
  - Add confirmation dialogs for trades above threshold (e.g., >10,000 sats)
  - Show fee breakdown on trade confirmation (LMSR cost + 1% fee)
- **Why**: Users must understand they're trading real money. No ambiguity.

### Frontend: Deposit/Withdraw UX
- **Action**: Modify wallet components
- **What**: 
  - Deposit: Generate Lightning invoice via NUT-04, display QR code, poll for payment, credit ecash to wallet
  - Withdraw: User enters Lightning invoice or LNURL, NUT-05 melt flow, confirm and execute
  - Show pending deposits/withdrawals with status
  - Handle errors gracefully: invoice expired, payment failed, insufficient balance
- **Why**: On/off-ramp is the first and last thing users do. Must be frictionless and reliable.

### Frontend: Error handling hardening
- **Action**: Modify `src/lib/services/cashuService.ts` and trade components
- **What**:
  - Retry logic for transient failures (network errors, 503s)
  - Clear error messages for: insufficient balance, trade limit reached, market paused, mint unreachable
  - Optimistic UI with rollback: show pending trade immediately, rollback if mint rejects
  - Never lose proofs: if a mint operation fails mid-way, stored proofs must be recoverable
- **Why**: Real money means errors are not just annoying — they're scary. Users must always know the state of their funds.

## Monitoring & Alerting — Production

### Metrics to Track
1. **Solvency**: `Lightning_balance - Σ(market_reserves)` — alert if < 10% of total reserves
2. **Trade success rate**: Alert if < 95% over any 1-hour window
3. **Deposit success rate**: Alert if < 90% (Lightning is inherently less reliable)
4. **Withdrawal latency**: Alert if P95 > 30 seconds
5. **Lightning channel health**: Alert if any channel < 20% capacity on either side
6. **Error rate**: Alert on any 5xx error spike (>5 per minute)
7. **Concurrent users**: Track for capacity planning

### Alerting Channels
- Critical (solvency, pause triggered): SMS + immediate notification to operator
- Warning (success rate drop, channel low): Chat notification (Telegram, Slack, or Nostr DM)
- Info (daily summary): Email digest

### Dashboards
- Real-time: System status, active markets, Lightning balance, trade volume (last 24h)
- Daily: Revenue (fees collected), unique users, market volume, solvency history
- Weekly: Growth trends, user retention, market lifecycle metrics

## Launch Sequence

1. **Deploy production Lightning node** — Open channels, verify connectivity. Fund with initial capital (suggest 5-10M sats).

2. **Deploy production cascade-mint** — PostgreSQL, TLS, rate limiting, exposure limits. Verify health endpoint.

3. **Admin tools verification** — Test pause/resume, verify admin endpoints work, test limit updates.

4. **Monitoring deployment** — Verify all alerts fire correctly. Run a synthetic test that triggers each alert.

5. **Closed beta** — Invite 5-10 trusted users. Small limits (10,000 sats/day per user). One or two markets only. Monitor everything.

6. **Iterate on closed beta feedback** — Fix bugs, adjust UX, tune limits. Duration: until confidence is high.

7. **Open beta** — Publish the mint URL. Keep exposure limits conservative. Add more markets gradually.

8. **Gradual limit relaxation** — As confidence grows and volume justifies it, increase limits:
   - Week 2: Double per-user limits
   - Month 1: Increase market caps to 5M sats
   - Month 3: Review all limits based on data

## Phase 2 Go/No-Go Gates (for limit relaxation)

Before increasing limits beyond launch values:

- [ ] 30+ days of continuous operation without critical incidents
- [ ] Solvency invariant has never been violated
- [ ] Trade success rate > 99% over 30 days
- [ ] Deposit success rate > 95% over 30 days
- [ ] At least 3 markets have completed full lifecycle (create → trade → resolve → settle)
- [ ] No user has reported lost funds
- [ ] All user support requests resolved within 24 hours
- [ ] Monitoring has caught and alerted on every incident

## Migration from Phase 0 (Third-Party Mint)

If Phase 0 ran with a third-party mint, migration to the custom mint involves:

1. **Announce migration date** — Give users 2 weeks notice
2. **Freeze new deposits on old mint** — Stop accepting deposits via third-party mint
3. **Grace period** — 2 weeks for users to withdraw remaining balances from old mint
4. **Enable new mint** — Point frontend to cascade-mint URL
5. **Support window** — 30 days of support for users who missed the migration window (manual fund recovery if possible)

This is straightforward because Cashu wallets hold proofs locally — users withdraw from old mint and deposit to new mint. No server-side migration needed for user balances.
