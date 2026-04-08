# Infrastructure — Cloud Hosting & Server Requirements

## Phase 1: Phoenixd Backend (Launch → ~$50K monthly volume)

### Minimum Server Specification

| Resource | Requirement | Rationale |
|---|---|---|
| **CPU** | 2 vCPUs (AMD EPYC / Intel Xeon) | CDK mint is single-threaded for cryptographic operations; Phoenixd is lightweight |
| **RAM** | 4 GB | CDK mint ~500MB, Phoenixd ~1GB, OS + buffer ~1.5GB |
| **Storage** | 80 GB SSD (NVMe preferred) | Mint database ~5GB projected first year, Phoenixd channel data ~10GB, logs ~10GB, OS ~15GB, buffer |
| **Network** | 1 Gbps, static IPv4, 2 TB/mo transfer | Lightning peer connections require stable networking; mint API traffic is minimal |
| **OS** | Ubuntu 24.04 LTS or Debian 12 | CDK targets Linux; LTS for stability |

### Recommended Hosting Providers

| Provider | Instance | Monthly Cost | Pros | Cons |
|---|---|---|---|---|
| **Hetzner Cloud** | CPX31 (4 vCPU, 8GB, 160GB) | ~€15/mo (~$16) | Best price/performance in EU, good network, hourly billing | EU-only datacenters, no US presence |
| **DigitalOcean** | s-2vcpu-4gb | ~$24/mo | Simple, predictable pricing, US/EU/APAC regions | Less raw performance per dollar |
| **Vultr** | vc2-2c-4gb | ~$24/mo | Global regions, bare metal upgrade path | Smaller community |
| **AWS Lightsail** | 2 vCPU, 4GB | ~$36/mo | AWS ecosystem integration, auto-snapshots | Vendor lock-in, egress costs above tier |
| **Dedicated (Hetzner)** | AX42 (Ryzen 5, 64GB, 2×512GB NVMe) | ~€47/mo | Massive headroom, no noisy neighbors | Monthly commitment, manual setup |

**Recommendation:** Hetzner Cloud CPX31 for Phase 1. Best cost efficiency, EU jurisdiction is favorable for privacy-focused services, and upgrading to dedicated hardware is seamless within Hetzner's ecosystem.

### Networking Requirements

```
┌─────────────────────────────────────────┐
│           Reverse Proxy (Caddy)          │
│  TLS termination, rate limiting          │
│  Port 443 → mint API                     │
│  Port 443 → admin API (IP-restricted)    │
├─────────────────────────────────────────┤
│         CDK Mint (cdk-mintd)             │
│  HTTP API on localhost:3338              │
│  WebSocket for NUT-17 subscriptions      │
├─────────────────────────────────────────┤
│        Lightning Backend (Phoenixd)      │
│  gRPC/HTTP on localhost:9740             │
│  P2P Lightning on port 9735              │
├─────────────────────────────────────────┤
│           Database (redb/SQLite)          │
│  Local file-based, no network exposure   │
└─────────────────────────────────────────┘
```

**Firewall rules (ufw/iptables):**
- Allow inbound: 443 (HTTPS), 9735 (Lightning P2P)
- Allow inbound (restricted): 22 (SSH, key-only, from admin IPs)
- Deny all other inbound
- Admin API accessible only via SSH tunnel or VPN — never exposed publicly

### Database Selection

CDK supports two embedded databases:

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **redb** | Zero-config, single-file, Rust-native, ACID, good read performance | Newer project, less ecosystem tooling, no SQL query capability | **Use for Phase 1** — simplest operations |
| **SQLite** | Battle-tested, SQL queries for analytics, easy backup with `.backup` | Requires WAL mode configuration for concurrent access, slight overhead | **Consider for Phase 2** if analytics queries are needed |

Both are file-based and backed up identically (file copy while mint is stopped, or SQLite `.backup` command).

## Phase 2: LND Backend (>$50K monthly volume)

### Upgraded Server Specification

| Resource | Requirement | Rationale |
|---|---|---|
| **CPU** | 4 vCPUs | LND pathfinding is CPU-intensive; channel management adds load |
| **RAM** | 16 GB | LND ~4-8GB with large channel graph, CDK mint ~1GB, buffer |
| **Storage** | 500 GB NVMe | LND channel.db grows significantly, full channel graph ~20GB |
| **Network** | 1 Gbps, static IPv4, 5 TB/mo transfer | More gossip traffic, more payment routing |

### Estimated Phase 2 Hosting Cost

| Provider | Instance | Monthly Cost |
|---|---|---|
| **Hetzner Dedicated** | AX42 | ~€47/mo (~$50) |
| **Hetzner Cloud** | CCX33 (8 vCPU, 32GB) | ~€70/mo (~$75) |
| **DigitalOcean** | s-4vcpu-16gb | ~$96/mo |

## Phase 3: High Availability (>$500K monthly volume)

At significant volume, deploy redundant infrastructure:

- **Primary + hot standby** mint instances (manual failover initially, automated later)
- **Separate database server** — PostgreSQL for mint state, enabling read replicas
- **Load balancer** — for API traffic distribution
- **Dedicated Lightning node** — separate server for LND with channel management automation

Estimated cost: $300-500/mo for full HA setup.

## DNS & Domain Configuration

```
mint.cascademarket.com        → Mint API (NUT-01 through NUT-17)
admin.cascademarket.com       → Admin panel (IP-restricted, authenticated)
```

TLS via Caddy's automatic Let's Encrypt integration. No manual cert management needed.

## Backup Infrastructure

| What | Method | Frequency | Retention | Storage |
|---|---|---|---|---|
| Mint database | File copy (stop mint briefly) or redb snapshot | Every 6 hours | 30 days | Separate Hetzner Storage Box (~€3/mo for 100GB) |
| Mint signing keys | Encrypted file, manual copy | On creation + rotation | Indefinite | Offline cold storage + encrypted cloud (2+ locations) |
| Lightning channel state | `lncli exportchanbackup` / SCB | Every channel change | Latest + daily snapshots | Separate server + encrypted cloud |
| Configuration | Git-tracked (secrets excluded) | Every change | Git history | Git remote |
| TLS certificates | Auto-renewed by Caddy | Automatic | N/A | Local |

## Execution Order

1. **Provision Hetzner Cloud CPX31** — Set up Ubuntu 24.04, create non-root user, configure SSH key auth, disable password auth
2. **Configure firewall** — ufw allow 443, 9735, 22 (restricted); deny all other inbound
3. **Install Caddy** — Configure reverse proxy with automatic TLS for `mint.cascademarket.com`
4. **Deploy CDK mint** — Build from source or use release binary; configure with redb backend
5. **Deploy Phoenixd** — Configure Lightning backend, connect to CDK mint
6. **Configure DNS** — Point `mint.cascademarket.com` A record to server IP
7. **Set up backup automation** — Cron job for database snapshots to Hetzner Storage Box
8. **Verify end-to-end** — Test mint info endpoint, test mint/melt cycle with small amounts
