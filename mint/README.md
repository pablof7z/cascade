# Cascade Mint

This directory contains the Rust implementation of the Cascade mint.

The canonical documentation for how the mint works lives in [`../docs/mint/`](../docs/mint/):

- [`../docs/mint/index.md`](../docs/mint/index.md)
- [`../docs/mint/architecture.md`](../docs/mint/architecture.md)
- [`../docs/mint/api.md`](../docs/mint/api.md)
- [`../docs/mint/lmsr.md`](../docs/mint/lmsr.md)
- [`../docs/mint/auth.md`](../docs/mint/auth.md)

Read those docs before changing route semantics, market mechanics, or trade attribution.

## Build

```bash
cargo build --workspace
```

## Test

```bash
cargo test --workspace
```

## Run

```bash
cargo run
```

Do not treat older payout, resolution, or fee language from removed docs as current behavior. Cascade markets never close, and buys/sells are the only market activity the mint should treat as trades.
