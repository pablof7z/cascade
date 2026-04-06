# Section 1: Project Setup

## Directory Structure

```
cascade-mint/
├── Cargo.toml                    # Workspace root
├── .env.example                  # Environment variable template
├── config.toml.example           # Mint configuration template
├── README.md                     # Setup and usage documentation
├── rust-toolchain.toml           # Pin Rust version
│
├── crates/
│   ├── cascade-mint/             # Main binary crate
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs           # Entry point, CLI args, init
│   │       └── config.rs         # Configuration loading
│   │
│   ├── cascade-core/             # Core business logic library
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs            # Module exports
│   │       ├── market.rs         # Market type definitions
│   │       ├── market_manager.rs # Market registry & lifecycle
│   │       ├── lmsr.rs           # LMSR pricing engine
│   │       ├── trade.rs          # Trade execution logic
│   │       ├── nostr_publisher.rs # Kind 983 trade event publishing
│   │       └── error.rs          # Error types
│   │
│   └── cascade-api/              # HTTP API layer
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs            # Module exports
│           ├── routes.rs         # Custom Cascade route registration
│           ├── handlers/
│           │   ├── mod.rs
│           │   ├── market.rs     # Market CRUD handlers
│           │   ├── trade.rs      # Trade execution handlers
│           │   ├── price.rs      # Price query handlers
│           │   └── resolve.rs    # Resolution handlers
│           └── types.rs          # Request/response DTOs
│
├── migrations/                   # Cascade-specific SQL migrations
│   └── 001_cascade_tables.sql
│
└── data/                         # Runtime data (gitignored)
    ├── cascade_mint.db           # SQLite database
    └── mint_seed.key             # Master seed (generated on first run)
```

## File Changes

### `cascade-mint/Cargo.toml` (workspace root)
- **Action**: create
- **What**: Cargo workspace manifest defining all member crates and shared dependencies
- **Why**: Workspace structure enables clean separation between binary, core logic, and API layer while sharing dependency versions

```toml
[workspace]
resolver = "2"
members = [
    "crates/cascade-mint",
    "crates/cascade-core",
    "crates/cascade-api",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
license = "MIT"

[workspace.dependencies]
# CDK crates — pin to a specific version once confirmed
cdk = { version = "0.7", features = ["mint"] }
cdk-axum = "0.7"
cdk-sqlite = { version = "0.7", features = ["mint"] }
cdk-signatory = { version = "0.7", features = ["mint"] }
cdk-lnd = "0.7"
cdk-common = "0.7"

# Async runtime
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# HTTP extras (for custom routes)
axum = { version = "0.8", features = ["json"] }
tower-http = { version = "0.6", features = ["cors", "trace"] }

# Database (for Cascade-specific tables beyond CDK's)
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }

# Configuration
toml = "0.8"
dotenvy = "0.15"
clap = { version = "4", features = ["derive", "env"] }

# Crypto
bitcoin = { version = "0.32", features = ["serde"] }
bip39 = "2"

# Nostr (for kind 983 trade event publishing — see 07-nostr-integration.md)
nostr-sdk = "0.37"

# Error handling
anyhow = "1"
thiserror = "2"

# Misc
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
```

### `cascade-mint/crates/cascade-mint/Cargo.toml`
- **Action**: create
- **What**: Binary crate that composes all pieces and runs the mint server
- **Why**: Thin binary crate — just initialization, config, and main loop

```toml
[package]
name = "cascade-mint"
version.workspace = true
edition.workspace = true

[[bin]]
name = "cascade-mint"
path = "src/main.rs"

[dependencies]
cascade-core = { path = "../cascade-core" }
cascade-api = { path = "../cascade-api" }
cdk.workspace = true
cdk-axum.workspace = true
cdk-sqlite.workspace = true
cdk-signatory.workspace = true
cdk-lnd.workspace = true
tokio.workspace = true
serde.workspace = true
serde_json.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
toml.workspace = true
dotenvy.workspace = true
clap.workspace = true
anyhow.workspace = true
sqlx.workspace = true
```

### `cascade-mint/crates/cascade-core/Cargo.toml`
- **Action**: create
- **What**: Library crate with market management, LMSR engine, trade logic
- **Why**: Core business logic must be testable independently of HTTP layer

```toml
[package]
name = "cascade-core"
version.workspace = true
edition.workspace = true

[dependencies]
cdk.workspace = true
cdk-common.workspace = true
cdk-sqlite.workspace = true
cdk-signatory.workspace = true
serde.workspace = true
serde_json.workspace = true
sqlx.workspace = true
tokio.workspace = true
tracing.workspace = true
thiserror.workspace = true
anyhow.workspace = true
uuid.workspace = true
chrono.workspace = true
nostr-sdk.workspace = true

[dev-dependencies]
tokio = { workspace = true, features = ["test-util"] }
```

### `cascade-mint/crates/cascade-api/Cargo.toml`
- **Action**: create
- **What**: HTTP API crate with custom Cascade routes
- **Why**: API handlers separated from core logic for clean architecture

```toml
[package]
name = "cascade-api"
version.workspace = true
edition.workspace = true

[dependencies]
cascade-core = { path = "../cascade-core" }
cdk.workspace = true
cdk-common.workspace = true
cdk-axum.workspace = true
axum.workspace = true
tower-http.workspace = true
serde.workspace = true
serde_json.workspace = true
tokio.workspace = true
tracing.workspace = true
thiserror.workspace = true
anyhow.workspace = true
```

### `cascade-mint/rust-toolchain.toml`
- **Action**: create
- **What**: Pin Rust toolchain version for reproducible builds
- **Why**: CDK crates may require specific Rust features

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
```

### `cascade-mint/.env.example`
- **Action**: create
- **What**: Template for environment variables
- **Why**: Documents all required configuration for operators

```env
# Mint identity
MINT_URL=https://mint.f7z.io
MINT_NAME=Cascade Markets Mint
MINT_DESCRIPTION=Cashu mint for Cascade prediction markets

# Database
DATABASE_PATH=./data/cascade_mint.db

# Seed file (generated on first run if not present)
SEED_PATH=./data/mint_seed.key

# LND connection
LND_HOST=127.0.0.1
LND_PORT=10009
LND_CERT_PATH=/path/to/tls.cert
LND_MACAROON_PATH=/path/to/admin.macaroon

# Network
NETWORK=testnet

# Server
LISTEN_HOST=127.0.0.1
LISTEN_PORT=3338

# Logging
RUST_LOG=cascade_mint=debug,cdk=info,tower_http=debug

# Nostr (kind 983 trade event publishing — see 07-nostr-integration.md)
# Comma-separated relay URLs. If empty, Nostr publishing is disabled.
NOSTR_RELAY_URLS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band
```

### `cascade-mint/config.toml.example`
- **Action**: create
- **What**: TOML configuration file for mint settings
- **Why**: Structured config for complex settings that don't fit well in env vars

```toml
[mint]
url = "https://mint.f7z.io"
name = "Cascade Markets Mint"
description = "Cashu mint for Cascade prediction markets"

[database]
path = "./data/cascade_mint.db"

[seed]
path = "./data/mint_seed.key"

[lnd]
host = "127.0.0.1"
port = 10009
cert_path = "/path/to/tls.cert"
macaroon_path = "/path/to/admin.macaroon"

[network]
type = "testnet"  # testnet | mainnet

[server]
host = "127.0.0.1"
port = 3338

[fees]
trade_fee_percent = 1  # 1% embedded in LMSR spread

[nostr]
# Relay URLs for publishing kind 983 trade events.
# If empty or omitted, Nostr publishing is disabled.
relay_urls = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
]
```

### `cascade-mint/.gitignore`
- **Action**: create
- **What**: Git ignore patterns for Rust project and runtime data

```gitignore
/target
/data/
*.db
*.key
.env
```

## Execution Steps

1. **Create workspace root** — `Cargo.toml`, `rust-toolchain.toml`, `.gitignore`
   - Verify: `cargo check` runs (will fail on missing crates but workspace parses)

2. **Create binary crate skeleton** — `crates/cascade-mint/Cargo.toml` and empty `main.rs`
   - Verify: `cargo check -p cascade-mint` parses

3. **Create core library crate skeleton** — `crates/cascade-core/Cargo.toml` and `lib.rs` with module declarations
   - Verify: `cargo check -p cascade-core` parses

4. **Create API crate skeleton** — `crates/cascade-api/Cargo.toml` and `lib.rs`
   - Verify: `cargo check -p cascade-api` parses

5. **Create config templates** — `.env.example`, `config.toml.example`
   - Verify: Files exist and are well-documented

6. **Run full workspace check** — `cargo check --workspace`
   - Verify: All crates resolve dependencies and compile (with stub implementations)
