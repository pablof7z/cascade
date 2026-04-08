# Security & Key Management

## Threat Model

### Assets at Risk

| Asset | Impact if Compromised | Probability | Priority |
|---|---|---|---|
| Mint signing keys | Total loss — attacker can mint unlimited tokens | Low (if properly stored) | **P0** |
| Lightning node keys | Loss of all channel funds | Low-Medium | **P0** |
| Database (token state) | Double-spend attacks, lost tokens | Medium | **P1** |
| TLS certificates | MitM attacks, phishing | Low | **P2** |
| Nostr keys (mint identity) | Impersonation, fake market resolution | Low | **P1** |

### Threat Actors

1. **External attackers** — Target the mint API, Lightning node, or infrastructure
2. **Insider threat** — Operator with access to keys
3. **Supply chain** — Compromised dependencies in CDK or Rust crates
4. **Physical access** — Datacenter compromise (unlikely with cloud)

## Mint Key Architecture

### How CDK Mint Keys Work

The CDK mint uses a hierarchical key structure per the Cashu NUT-02 specification:

1. **Mint master secret** — A single secret from which all keyset keys are derived
2. **Keysets** — Each keyset is a set of denomination-specific public/private key pairs
3. **Keyset derivation** — From master secret + keyset ID, individual denomination keys are derived
4. **Active keysets** — Only one keyset is active for new token issuance; old keysets remain valid for redemption

**Critical implication:** If the master secret is lost, ALL existing tokens become irredeemable. If it's stolen, the attacker can mint unlimited tokens.

### Key Storage Tiers

#### Tier 1: File-Based (Launch — Phase 1)

```
Storage: Encrypted file on disk
Protection: File permissions (600), full-disk encryption (LUKS/dm-crypt)
Backup: Encrypted copy in separate geographic location
Risk: Vulnerable to root access compromise
```

**Implementation in CDK:**
- CDK stores the mint secret in the database (redb or SQLite)
- The database file itself should be on an encrypted volume
- Backup the database file with gpg encryption before off-site transfer

**Steps:**
1. Enable full-disk encryption on the VPS (LUKS with passphrase stored in provider's secure boot)
2. Set database file permissions to `600`, owned by the mint process user
3. Run mint as dedicated non-root user with minimal permissions
4. Automated daily backup: `gpg --encrypt --recipient <backup-key> /path/to/mint.db`
5. Transfer encrypted backup to S3-compatible storage in a different region

#### Tier 2: Envelope Encryption (Growth — Phase 2)

```
Storage: Database file encrypted with a KEK (Key Encryption Key)
KEK Storage: Cloud KMS (e.g., AWS KMS, Hetzner doesn't offer — use Hashicorp Vault)
Protection: KEK never leaves KMS/Vault; database decrypted only in memory
Risk: Reduced — compromise requires both server access AND KMS access
```

**Implementation:**
1. Deploy Hashicorp Vault (single node, Raft storage) alongside the mint
2. Store mint database encryption key in Vault
3. Mint binary retrieves decryption key at startup via Vault API (AppRole auth)
4. Key is held only in memory during runtime
5. Vault audit log tracks all key access

#### Tier 3: HSM Integration (Scale — Phase 3)

```
Storage: Signing operations happen inside HSM; private key never exported
Protection: FIPS 140-2 Level 3 tamper-resistant hardware
Risk: Minimal — even root access cannot extract keys
Options: AWS CloudHSM ($1.50/hr ≈ $1,100/mo), YubiHSM 2 ($650 one-time + USB passthrough)
```

**Note:** CDK does not currently have native HSM support. This would require a custom signing backend:
1. Implement a `MintKeyStore` trait that delegates signing to HSM via PKCS#11
2. Upstream this to CDK or maintain as a Cascade fork
3. **Recommendation: Defer HSM to Phase 3.** Tier 2 (Vault) provides sufficient security for the expected value at risk in Phases 1-2.

## Lightning Node Key Security

### LND Key Files

LND stores keys in:
- `wallet.db` — Contains the wallet seed and derived keys
- `tls.cert` / `tls.key` — Node identity TLS
- `admin.macaroon` — Full admin access to LND

### Phoenixd Key Files

Phoenixd is simpler:
- Seed phrase — Stored in configuration
- No macaroon system — API authentication via shared secret

### Protection Measures

| Measure | Phase 1 (Phoenixd) | Phase 2 (LND) |
|---|---|---|
| Dedicated user | ✅ Run as `phoenixd` user | ✅ Run as `lnd` user |
| File permissions | ✅ 600 on seed config | ✅ 600 on wallet.db, macaroons |
| Disk encryption | ✅ LUKS | ✅ LUKS |
| Network isolation | ✅ Firewall, only mint can reach Phoenixd | ✅ Firewall, separate subnet |
| Backup | ✅ Encrypted seed backup | ✅ SCB (static channel backup) to S3 |
| Macaroon rotation | N/A | ✅ Bake time-limited macaroons for mint access |

## Backup Strategy

### What Must Be Backed Up

| Data | Backup Method | Frequency | Retention |
|---|---|---|---|
| Mint database (redb/SQLite) | GPG-encrypted snapshot to S3 | Every 6 hours | 30 days rolling |
| Mint master secret | GPG-encrypted, split via Shamir's Secret Sharing | On creation + rotation | Forever (cold storage) |
| Lightning wallet seed | Written on paper (cold) + encrypted digital | On creation | Forever |
| LND SCB (channel state) | Encrypted to S3 | Every channel change | 7 days rolling |
| TLS certificates | Version controlled or re-issuable via Let's Encrypt | On renewal | Current + 1 previous |
| Configuration files | Version controlled (git, private repo) | On change | Full history |

### Backup Verification

- **Monthly:** Restore mint database to a test environment, verify token state
- **Quarterly:** Full disaster recovery drill — bring up mint from backups on fresh infrastructure
- **On every keyset rotation:** Verify old keyset redemption still works from backup

### Shamir's Secret Sharing for Master Secret

The mint master secret should be split using Shamir's Secret Sharing (3-of-5 threshold):

1. Generate 5 shares of the master secret
2. Distribute to 5 separate storage locations:
   - Share 1: Operator's hardware wallet/safe
   - Share 2: Encrypted in cloud provider A (e.g., AWS Secrets Manager)
   - Share 3: Encrypted in cloud provider B (e.g., different region/provider)
   - Share 4: Trusted third party (e.g., company counsel or co-founder)
   - Share 5: Physical safe deposit box
3. Any 3 shares can reconstruct the master secret
4. Losing up to 2 shares doesn't compromise recovery

## Key Rotation

### Keyset Rotation (Cashu NUT-02)

CDK supports multiple keysets. Rotation procedure:

1. Generate new keyset from master secret + new keyset ID
2. Mark old keyset as inactive (no new issuance)
3. Old keyset remains valid for redemption indefinitely
4. Publish new keyset info via NUT-01 `GET /v1/keys` and NUT-02 `GET /v1/keysets`

**Rotation schedule:** Every 90 days, or immediately if compromise is suspected.

**Warning:** Keyset rotation does NOT protect against master secret compromise since all keysets derive from it. If master secret is compromised, a new master secret must be generated — but this invalidates ALL existing tokens. This is a catastrophic scenario requiring user notification and token migration.

### Lightning Key Rotation

- **LND:** Wallet keys cannot be rotated without creating a new wallet. Rotate macaroons regularly.
- **Phoenixd:** Seed cannot be rotated. API secret can be rotated.

## Network Security

### Firewall Rules

```
# Inbound
443/tcp   → Reverse proxy (Caddy/nginx) — public, TLS termination
9090/tcp  → Prometheus metrics — internal only (monitoring server)

# Mint ↔ Lightning (internal)
8080/tcp  → Phoenixd HTTP API — localhost or private network only
10009/tcp → LND gRPC — private network only

# Outbound
443/tcp   → Lightning peer connections (P2P gossip, channel management)
8333/tcp  → Bitcoin Core P2P (if running full node)
9735/tcp  → Lightning P2P
```

### DDoS Mitigation

1. **Rate limiting at reverse proxy:** 10 requests/second per IP for minting/melting, 100/sec for info endpoints
2. **Cloudflare or equivalent:** Optional DDoS protection layer (note: Cloudflare may not be ideal for privacy-focused service)
3. **Proof of work on minting:** CDK supports NUT-14 (proof of work) as optional anti-spam
4. **Circuit breaker:** If minting volume exceeds 10x normal, pause and alert operator

### API Security

- All endpoints over HTTPS only (HSTS enabled)
- No CORS wildcard — restrict to Cascade frontend domains
- Authentication not required for standard NUT endpoints (spec-compliant)
- Admin endpoints (if any) behind separate port + auth token
- Request size limits: 1MB max body
- Input validation: CDK handles this for NUT-compliant requests

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| **SEV-0** | Key compromise confirmed | Immediate | Master secret leaked, unauthorized minting |
| **SEV-1** | Suspected compromise or fund loss | < 1 hour | Unexpected balance changes, suspicious API calls |
| **SEV-2** | Service degradation | < 4 hours | Lightning node offline, high error rate |
| **SEV-3** | Minor issue | Next business day | Monitoring gap, non-critical bug |

### SEV-0 Response Playbook

1. **Immediately** disable all minting (set mint to read-only/redemption-only mode)
2. **Assess** which keys are compromised (master secret vs individual keyset vs Lightning)
3. **If master secret:** Announce to all users, begin emergency token migration
4. **If keyset only:** Rotate keyset, revoke compromised keyset, issue replacement tokens
5. **If Lightning:** Close all channels to on-chain addresses controlled by operator
6. **Post-incident:** Full audit, root cause analysis, security improvements
