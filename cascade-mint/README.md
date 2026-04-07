# Cascade Cashu Mint

A production-grade Cashu ecash mint for Cascade prediction markets, built with CDK (Cashu Development Kit) in Rust.

## Features

- **NUT-compliant Cashu mint** using CDK Rust crates
- **Per-market keysets** with custom LONG/SHORT currency units
- **LMSR pricing engine** for automated market making
- **LND Lightning integration** for deposits/withdrawals
- **SQLite persistence** for markets, trades, and LMSR state
- **Custom HTTP API** for market creation, trading, and resolution

## Architecture

```
cascade-mint binary
├── HTTP Layer (cdk-axum)
│   ├── Standard NUT Endpoints (/v1/info, /v1/keys, /v1/mint/*, etc.)
│   └── Custom Cascade Routes (/v1/cascade/markets, /v1/cascade/trade, etc.)
├── CDK Mint Core (blind signing, proof verification, keyset management)
└── Cascade Core (market registry, LMSR engine, trade execution)
```

## Setup

1. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

2. Configure LND connection (TLS cert and macaroon paths)

3. Build:
   ```bash
   cargo build --release
   ```

4. Run:
   ```bash
   ./target/release/cascade-mint
   ```

## Configuration

Configuration is loaded from `config.toml` with environment variable overrides.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINT_URL` | Mint public URL | `https://mint.f7z.io` |
| `MINT_NAME` | Mint display name | `Cascade Markets Mint` |
| `DATABASE_PATH` | SQLite database path | `./data/cascade_mint.db` |
| `SEED_PATH` | Master seed file path | `./data/mint_seed.key` |
| `LND_HOST` | LND gRPC host | `127.0.0.1` |
| `LND_PORT` | LND gRPC port | `10009` |
| `LND_CERT_PATH` | TLS certificate path | - |
| `LND_MACAROON_PATH` | Admin macaroon path | - |
| `NETWORK` | Bitcoin network | `testnet` |
| `LISTEN_HOST` | Server bind address | `127.0.0.1` |
| `LISTEN_PORT` | Server port | `3338` |
| `TRADE_FEE_PERCENT` | Trade fee percentage | `1` |

## Custom API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/cascade/markets` | List all active markets |
| `POST` | `/v1/cascade/markets` | Create a new market |
| `GET` | `/v1/cascade/markets/:slug` | Get market details |
| `POST` | `/v1/cascade/trade/buy` | Buy position tokens |
| `POST` | `/v1/cascade/trade/sell` | Sell position tokens |
| `POST` | `/v1/cascade/trade/payout` | Claim winnings after resolution |
| `GET` | `/v1/cascade/price/:slug` | Get current prices |
| `POST` | `/v1/cascade/price/:slug/quote` | Get a trade quote |
| `POST` | `/v1/cascade/resolve/:slug` | Resolve a market |

## Deployment

### Docker

The easiest way to deploy is using Docker Compose:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your MINT_PRIVATE_KEY and LND settings

# Start the mint with LND
docker-compose up -d

# View logs
docker-compose logs -f mint
```

### Local Testnet Setup

For development/testing on Bitcoin Signet:

1. Start LND in signet mode:
```bash
docker run -d --name lnd \
  -e RPCEXTERNALIP=your-public-ip \
  -p 10009:10009 \
  lightninglab/lnd:v0.17.4-beta \
  --bitcoin.active \
  --bitcoin.signet \
  --bitcoin.node=neutrino \
  --neutrino.connect=btcd.signet:18333
```

2. Wait for LND to sync, then create the mint admin macaroon:
```bash
docker exec lnd lncli --network=signet create
```

3. Configure your `.env` with the LND settings

4. Build and run the mint:
```bash
cargo build --release
./target/release/cascade-mint
```

### Production Deployment

#### 1. Build the binary
```bash
cargo build --release
# Binary: target/release/cascade-mint
```

#### 2. Create a deploy user
```bash
sudo useradd -r -s /usr/bin/nologin cascade
sudo mkdir -p /opt/cascade-mint
sudo cp target/release/cascade-mint /opt/cascade-mint/
sudo chown -R cascade:cascade /opt/cascade-mint
```

#### 3. Install systemd service
```bash
sudo cp deploy/systemd/cascade-mint.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cascade-mint
sudo systemctl start cascade-mint
```

#### 4. Configure nginx reverse proxy
```bash
sudo cp deploy/nginx/mint.f7z.io /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/mint.f7z.io /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Health check
```bash
curl https://mint.f7z.io/health
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MINT_PRIVATE_KEY` | Master seed (32-byte hex) | Yes |
| `DATABASE_URL` | SQLite database path | Yes |
| `LND_GRPC_URL` | LND gRPC endpoint | Yes |
| `LND_CERT_PATH` | TLS certificate path | Yes |
| `LND_MACAROON_PATH` | Admin macaroon path | Yes |
| `RUST_LOG` | Log level | No (default: info) |

See `.env.example` for the full configuration.

### Monitoring

- Health endpoint: `GET /health`
- Logs: `journalctl -u cascade-mint -f`
- Binary size: ~10-15 MB
- Startup time: <2 seconds

## Development

```bash
# Build
cargo build --workspace

# Test
cargo test --workspace

# Run with logging
RUST_LOG=debug cargo run
```

## License

MIT