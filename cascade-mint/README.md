# Cascade Mint

A Cashu mint implementation with binary prediction market support for Cascade markets.

## Features

- Cashu ecash mint based on CDK Rust
- Binary prediction market trading (YES/NO outcomes)
- LMSR market maker math
- Nostr integration for market event publishing
- SQLite persistence
- HTTP API for market operations

## Project Structure

```
cascade-mint/
├── Cargo.toml           # Workspace manifest
├── config.toml.example  # Configuration template
├── .env.example         # Environment variables template
├── rust-toolchain.toml   # Rust toolchain config
└── crates/
    ├── cascade-mint/    # Main binary
    ├── cascade-core/    # Core library (markets, trading, LMSR)
    └── cascade-api/     # HTTP API
```

## Setup

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Configure Environment

```bash
cp .env.example .env
cp config.toml.example config.toml

# Edit .env with your settings
nano .env
```

### 3. Build

```bash
cargo build --workspace
```

### 4. Run

```bash
# Development
cargo run -p cascade-mint

# Production
./target/debug/cascade-mint --config config.toml
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| MINT_URL | Mint API URL | http://localhost:8080 |
| DATABASE_PATH | SQLite database path | ./data/mint.db |
| SEED_PATH | Signing key path | ./data/seed.key |
| NETWORK | Bitcoin network | bitcoin |
| LISTEN_HOST | Server bind host | 0.0.0.0 |
| LISTEN_PORT | Server port | 8080 |
| NOSTR_RELAY_URLS | Nostr relay URLs | - |

### CLI Options

```bash
cascade-mint --help
```

## API Endpoints

The mint exposes:

- Cashu mint API endpoints (NUT-06, NUT-07, NUT-08, NUT-09)
- Market management endpoints
- Trade execution endpoints
- Resolution endpoints

## License

MIT
