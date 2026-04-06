# Cascade Mint - CDK Rust Deployment Guide

## Overview

This document describes how to deploy and run the Cascade Mint service built on the Cashu CDK Rust implementation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cascade Frontend (SvelteKit)            │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cascade Mint (Axum + CDK Rust)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Market     │  │   Trade     │  │   Resolution        │ │
│  │  Manager    │  │  Executor   │  │   Payouts           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
│                   ┌──────▼──────┐                          │
│                   │  CDK Mint   │                          │
│                   │  (cdk-rust) │                          │
│                   └──────┬──────┘                          │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ SQLite   │ │ Lightning│ │  Signer      │
        │ Database │ │ (LND)    │ │  (CDK Sign)  │
        └──────────┘ └──────────┘ └──────────────┘
```

## Prerequisites

### Required
- **Rust 1.70+** with `cargo`
- **SQLite 3.35+** (for FTS5 support)
- **Lightning Node** (LND or Core Lightning) for mint payments

### Optional
- **Nostr Relay** for market event publishing
- **Monitoring** (Prometheus metrics endpoint)

## Environment Variables

### Required Environment Variables

```bash
# Mint Configuration
MINT_PRIVATE_KEY="nsec1..."                    # Mint's Nostr private key (hex or nsec)
DATABASE_URL="sqlite:///var/lib/cascade/mint.db"  # SQLite database path

# Lightning Configuration (choose one)
# Option 1: LND
LND_GRPC_URL="https://localhost:10009"
LND_CERT_PATH="/path/to/tls.cert"
LND_MACAROON_PATH="/path/to/admin.macaroon"

# Option 2: Core Lightning
CLN_RPC_PATH="/path/to/lightning-rpc"

# Mint Keysets
MINT_KEYSETS="long:secret_keyset_id,short:another_keyset_id"

# Optional
RUST_LOG="info,cascade_mint=debug"             # Logging level
PORT="8000"                                    # HTTP server port
```

## Local Development

### 1. Clone and Setup

```bash
cd cascade-mint
cargo build --release
```

### 2. Configure Environment

Create a `.env` file:

```bash
MINT_PRIVATE_KEY="nsec1..."
DATABASE_URL="sqlite:///tmp/cascade-mint.db"
LND_GRPC_URL="https://localhost:10009"
LND_CERT_PATH="~/.lnd/tls.cert"
LND_MACAROON_PATH="~/.lnd/data/chain/bitcoin/signet/admin.macaroon"
RUST_LOG="debug"
PORT="8080"
```

### 3. Run Database Migrations

```bash
# Migrations run automatically on startup
# For manual migration:
cargo run --bin migrate
```

### 4. Start the Service

```bash
# Development mode with hot reload
cargo watch run

# Production mode
cargo run --release
```

### 5. Verify Installation

```bash
# Check mint info
curl http://localhost:8080/api/v1/mint

# Check health
curl http://localhost:8080/health
```

## Production Deployment

### Docker

```dockerfile
FROM rust:1.70-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates
COPY --from=builder /app/target/release/cascade-mint /usr/local/bin/
COPY --from=builder /app/migrations /migrations
EXPOSE 8080
CMD ["cascade-mint"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mint:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MINT_PRIVATE_KEY=${MINT_PRIVATE_KEY}
      - DATABASE_URL=sqlite:///data/mint.db
      - LND_GRPC_URL=https://lnd:10009
      - LND_CERT_PATH=/certs/tls.cert
      - LND_MACAROON_PATH=/macaroons/admin.macaroon
      - RUST_LOG=info
    volumes:
      - ./data:/data
      - ./certs:/certs:ro
      - ./macaroons:/macaroons:ro
    depends_on:
      - lnd
    restart: unless-stopped

  lnd:
    image: lightninglab/lnd:v0.17.0
    # ... LND configuration
```

### Systemd Service

```ini
[Unit]
Description=Cascade Mint Service
After=network.target lnd.service
Requires=lnd.service

[Service]
Type=simple
User=mint
Group=mint
EnvironmentFile=/etc/cascade-mint/env
ExecStart=/usr/local/bin/cascade-mint
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name mint.example.com;

    ssl_certificate /etc/ssl/certs/mint.crt;
    ssl_certificate_key /etc/ssl/private/mint.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8080;
    }
}
```

## Health Checks

### Endpoints

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe (checks DB + Lightning)
- `GET /health/live` - Liveness probe
- `GET /metrics` - Prometheus metrics

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 15

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Monitoring

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `cascade_mint_trades_total` | Counter | Total number of trades executed |
| `cascade_mint_trade_volume_sats` | Counter | Total trade volume in sats |
| `cascade_mint_market_count` | Gauge | Number of active markets |
| `cascade_mint_lightning_invoices` | Counter | Lightning invoices created |
| `cascade_mint_resolution_total` | Counter | Market resolutions by outcome |
| `cascade_http_requests_total` | Counter | HTTP requests by endpoint |
| `cascade_http_request_duration_seconds` | Histogram | Request latency |

### Grafana Dashboard

Import the dashboard from `deploy/grafana/dashboard.json` for:
- Trade volume over time
- Active markets chart
- Lightning payment success rate
- Request latency percentiles

## Backup and Recovery

### Database Backup

```bash
# Hot backup (SQLite)
sqlite3 /var/lib/cascade/mint.db ".backup '/backup/mint-$(date +%Y%m%d).db'"

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/mint"
DATE=$(date +%Y%m%d-%H%M%S)
sqlite3 "$DATABASE_URL" ".backup '$BACKUP_DIR/mint-$DATE.db'"
# Keep last 30 days
find "$BACKUP_DIR" -name "mint-*.db" -mtime +30 -delete
```

### Recovery

```bash
# Stop service
systemctl stop cascade-mint

# Restore database
sqlite3 /var/lib/cascade/mint.db ".restore '/backup/mint-20240115.db'"

# Verify integrity
sqlite3 /var/lib/cascade/mint.db "PRAGMA integrity_check;"

# Restart service
systemctl start cascade-mint
```

## Security Considerations

1. **Private Key Protection**
   - Store mint private key in HSM or secure vault
   - Use environment variable or secrets manager
   - Never commit keys to version control

2. **Lightning Node Security**
   - Use separate LND instance for mint operations
   - Restrict macaroon permissions (no invoice macaroons for mint)
   - Enable TLS for LND connection

3. **Network Security**
   - Run behind reverse proxy with TLS
   - Implement rate limiting
   - Use fail2ban for brute-force protection

4. **Database Security**
   - Set appropriate file permissions (chmod 600)
   - Enable SQLite encryption if sensitive
   - Regular integrity checks

## Troubleshooting

### Common Issues

**Database Locked**
```
Error: database is locked
Solution: Ensure only one instance is running; check for stale connections
```

**Lightning Connection Failed**
```
Error: failed to connect to LND
Solution: Verify LND is running, check cert/macaroon paths
```

**Migration Failed**
```
Error: migration error
Solution: Check SQLite version (need 3.35+); backup DB, then migrate
```

### Logs

```bash
# View recent logs
journalctl -u cascade-mint -n 100 --no-pager

# Follow logs
journalctl -u cascade-mint -f

# With debug logging
RUST_LOG=debug systemctl restart cascade-mint
```

### Debug Mode

```bash
# Run with debug logging
RUST_LOG=debug cargo run

# Enable tracing for async operations
RUST_LOG=trace cargo run

# With backtrace
RUST_BACKTRACE=1 cargo run
```

## API Reference

### Mint Endpoints (CDK Standard)

```
POST /api/v1/mint/keysets           # Create new keyset
GET  /api/v1/mint/keysets           # List keysets
POST /api/v1/mint/melt              # Melt (spend) tokens
POST /api/v1/mint/mint              # Mint new tokens
GET  /api/v1/mint/quote/melt        # Get melt quote
GET  /api/v1/mint/quote/mint        # Get mint quote
POST /api/v1/mint/swap              # Swap tokens
```

### Cascade Endpoints (Custom)

```
POST   /api/v1/markets              # Create market
GET    /api/v1/markets              # List markets
GET    /api/v1/markets/:id          # Get market
POST   /api/v1/markets/:id/trade    # Execute trade
POST   /api/v1/markets/:id/resolve  # Resolve market (admin)
GET    /api/v1/markets/:id/trades   # List trades for market
```

### WebSocket Endpoints

```
WS /ws/markets                     # Subscribe to all markets
WS /ws/markets/:id                 # Subscribe to specific market
```

## Performance Tuning

### Connection Pool

```bash
DATABASE_POOL_SIZE=10          # Max DB connections (default: 5)
```

### Request Limits

```bash
MAX_TRADE_AMOUNT=1000000       # Max sats per trade
RATE_LIMIT_RPM=100             # Requests per minute per IP
```

### Cache Configuration

```bash
CACHE_TTL_SECONDS=60           # Cache TTL for market data
```
