# Operations — Security, Monitoring, Backups & Key Management

## Mint Key Security

### The Core Risk

The mint's private key is the **master key to all issued ecash**. If compromised, an attacker can mint unlimited tokens, draining all Lightning channel funds. This is the single highest-impact security concern.

### Key Hierarchy

CDK uses a hierarchical key structure:

1. **Mint master key** — The root secret. All keyset keys derive from this via BIP-32-like derivation.
2. **Keyset keys** — Derived per-keyset. Each keyset has keys for each denomination (1, 2, 4, 8, 16... sats).
3. **Cascade-specific keysets** — LONG/SHORT keysets per market, all derived from the same mint master key.

**Critical implication:** Protect the master key and all issued ecash is protected. Lose the master key and all ecash becomes un-redeemable.

### Key Storage Options

| Option | Security | Complexity | Recommendation |
|--------|----------|------------|----------------|
| File on disk (default CDK) | Low | Low | Beta only, with disk encryption |
| Environment variable | Medium | Low | Better than file, but visible in process list |
| Docker secret | Medium | Medium | Good for Docker deployment |
| HSM (YubiHSM, AWS CloudHSM) | High | High | Future, when volume justifies $500+/mo |
| Threshold signing (FROST) | Very High | Very High | Not yet supported by CDK |

**Recommended approach:**
- **Beta:** Encrypted file on disk (LUKS-encrypted volume) + strong passphrase injected via environment variable at startup. The master secret seed is configured via CDK's `MINT_PRIVATE_KEY` env var.
- **Production:** Docker secrets or Vault (HashiCorp) for key injection. Never committed to git, never in logs.

### Key Backup

- Master key backup: Written to paper (mnemonic if CDK supports it) and stored offline
- Encrypted digital backup: GPG-encrypted copy in separate physical location
- **Never** store the mint key and the backup in the same cloud provider account
- Document key recovery procedure and test it during beta

## Database Operations (SQLite)

### Why SQLite for Beta/Early Production

- Zero operational overhead — no database server to manage
- Excellent read performance for the access patterns (keyset lookups, proof verification)
- WAL mode enables concurrent reads with a single writer
- Sufficient for hundreds of concurrent users (CDK's SQLite backend is well-tested)

### SQLite Configuration

```toml
# In CDK config (mint.toml or equivalent)
[database]
engine = "sqlite"
path = "/data/mint/cashu.sqlite"
```

Essential pragmas for production (should be set in CDK or at connection init):
- `PRAGMA journal_mode=WAL;` — Write-Ahead Logging for concurrent reads
- `PRAGMA synchronous=NORMAL;` — Good durability/performance balance
- `PRAGMA foreign_keys=ON;` — Data integrity
- `PRAGMA busy_timeout=5000;` — Wait up to 5s on lock contention

### When to Migrate to PostgreSQL

Triggers for PostgreSQL migration:
- Write contention causing >100ms delays (observable via monitoring)
- Need for read replicas (unlikely at early scale)
- Database file exceeds 10GB (very unlikely for a mint)
- Operational need for point-in-time recovery (pg_basebackup)

Migration path: CDK supports PostgreSQL as an alternative backend. Switch `engine = "postgres"` and run CDK's migration tool. Plan for 1–2 hours of downtime.

### Backup Strategy

**Frequency:**
- Every 6 hours: Full SQLite backup via `.backup` command
- Before every keyset rotation or deployment
- Before and after market settlements

**Method:**
```bash
# Safe SQLite backup (uses SQLite's built-in backup API)
sqlite3 /data/mint/cashu.sqlite ".backup /backup/cashu-$(date +%Y%m%d-%H%M%S).sqlite"
```

**Storage:**
- On-server: Last 7 days of 6-hourly backups
- Off-server: Daily backups to Backblaze B2 or equivalent, retained 90 days
- Encrypted with GPG before upload

**Verification:**
- Weekly automated restore test — restore backup to temp location, run integrity check
- `PRAGMA integrity_check;` on backup files

## Lightning Node Operations

### Channel Management

**Inbound liquidity (for minting — users sending sats to mint):**
- Acquire via LSP (Lightning Service Provider) channel leases
- Options: LNBIG, Voltage LSP, Amboss Magma marketplace
- Start with 5M sats inbound, scale based on daily mint volume
- Monitor channel balance; rebalance when inbound drops below 30%

**Outbound liquidity (for melting — mint paying out to users):**
- Naturally accumulates as users mint (inbound payments increase local balance)
- May need explicit outbound channels if many users melt without new mints
- Circular rebalancing via services like Lightning Loop

**Channel monitoring:**
- Alert if total inbound liquidity < expected daily mint volume
- Alert if any channel force-closes (indicates peer issues)
- Track routing fee costs as percentage of volume

### Lightning Failure Handling

| Failure | Impact | Response |
|---------|--------|----------|
| Payment stuck (in-flight) | User waiting for mint/melt | CDK has pending state; auto-retries. Alert after 10 min. |
| Channel force-close | Reduced liquidity | Open replacement channel. Funds recover after timelock (~144 blocks). |
| All channels offline | Mint/melt unavailable | Alert immediately. Markets still function (ecash is peer-to-peer). |
| Routing failure | User can't melt | CDK retries with different routes. Increase channel diversity. |

## Monitoring & Alerting

### Key Metrics

**Mint Health:**
- Mint process uptime
- API response latency (p50, p95, p99)
- Active WebSocket connections (for NUT-17 subscriptions)
- Proof verification rate (successes vs failures)
- Double-spend attempt rate

**Financial:**
- Total ecash outstanding (issued minus redeemed)
- Lightning channel balances (inbound vs outbound)
- Minting volume (sats/hour, sats/day)
- Melting volume (sats/hour, sats/day)
- Reserve ratio: Lightning balance / ecash outstanding (must be ≥ 1.0)

**Cascade Application:**
- Active markets count
- Open positions value (total sats in active markets)
- Settlement success rate
- Rake collected (sats/day)

**Infrastructure:**
- CPU, RAM, disk usage
- Network I/O
- SQLite WAL file size (large WAL = checkpoint lag)
- TLS certificate expiry

### Monitoring Stack (Recommended)

- **Prometheus** — On-host, scrapes CDK metrics endpoint and system metrics
- **Grafana** — Dashboard visualization, Grafana Cloud free tier (or self-hosted)
- **Alertmanager** — Routes alerts to Telegram/Discord/email
- **node_exporter** — System metrics (CPU, RAM, disk, network)
- **Custom exporter** — Cascade-specific metrics (market volume, rake, positions)

### Critical Alerts (Must Have Before Launch)

| Alert | Condition | Severity |
|-------|-----------|----------|
| Mint process down | Process not responding for 60s | Critical |
| Reserve imbalance | Lightning balance < ecash outstanding | Critical |
| Disk space low | < 20% free | Warning |
| Backup failed | Backup script exit code ≠ 0 | Warning |
| High error rate | > 5% API requests returning 5xx | Warning |
| Channel force-close | Any channel force-closed | Warning |
| Certificate expiry | < 14 days until expiry | Warning |
| Double-spend detected | Any double-spend attempt | Info (expected) |

## Keyset Rotation

### Why Rotate Keysets

- **Security:** Limits exposure if a key is compromised — old keysets can be deactivated
- **Fee changes:** New keysets can have different `input_fee_ppk` settings
- **Cascade markets:** Each market already gets unique LONG/SHORT keysets, providing natural isolation

### Rotation Procedure

1. Generate new keyset (CDK API or config change + restart)
2. Mark old keyset as inactive — existing tokens remain valid for redemption
3. New mints use the new keyset; swaps from old to new keyset are free
4. After grace period (e.g., 30 days), old keyset tokens should be swapped
5. Monitor unswapped tokens from old keyset

**Cascade-specific:** Market keysets are inherently time-bounded (market duration). When a market resolves, its LONG/SHORT keysets are effectively retired. No explicit rotation needed for market keysets — just ensure they're cleaned up in the database after final settlement.

### Keyset Audit

- Maintain a log of all keysets created: ID, creation time, purpose (market ID or default), active/inactive status
- Regularly verify: sum of ecash issued per keyset ≤ sum of Lightning received for that keyset
- Alert on any discrepancy (indicates potential double-mint bug or compromise)

## Deployment & Updates

### Deployment Process

1. **Build**: Compile Rust binary (release mode) in CI or locally
2. **Test**: Run against testnet/signet Lightning before deploying to production
3. **Stage**: Deploy to staging environment (if available) or deploy with feature flags
4. **Deploy**: Docker pull + restart, or systemd service restart
5. **Verify**: Health check endpoint, verify mint info endpoint, test a small mint/melt cycle
6. **Monitor**: Watch metrics for 30 minutes post-deploy

### Zero-Downtime Considerations

- Mint downtime means users can't mint or melt (but existing ecash remains valid peer-to-peer)
- Short maintenance windows (< 5 min) are acceptable during beta
- For production: Use health checks + rolling restart if running multiple instances (future)
- **Always** back up the database before deploying updates

### Rollback Plan

1. Stop the new version
2. Restore the pre-deployment database backup
3. Start the previous version
4. Verify mint operations
5. Investigate what went wrong before re-attempting upgrade

**Warning:** Rolling back the database after new tokens have been issued is dangerous — those tokens would become un-redeemable. Only roll back if the new version failed before processing any transactions.

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| P0 | Funds at risk | Immediate | Key compromise, reserve imbalance |
| P1 | Service down | < 15 min | Mint process crashed, all channels offline |
| P2 | Degraded service | < 1 hour | High latency, one channel offline |
| P3 | Minor issue | < 24 hours | Monitoring gap, log rotation failure |

### P0 Response (Funds at Risk)

1. **Stop the mint immediately** — prevent further minting
2. Close all Lightning channels cooperatively (if possible) to recover funds
3. Identify the breach vector
4. Generate new mint keys
5. Plan token migration for existing holders (issue new tokens from new keys)
6. Post-mortem within 24 hours

### Communication

- Status page (can be a simple static page or GitHub issue)
- Nostr announcement (NIP-01 kind 1 note from Cascade's npub)
- Direct notification to active users if possible (NIP-04 DMs)
