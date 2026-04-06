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