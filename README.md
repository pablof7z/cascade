# Cascade

Cascade is a dollar-denominated prediction market product built on Nostr plus a custom Cashu mint. Markets are perpetual, trading is LMSR-priced, and the normal product language is funding, minting, withdrawing, and exiting positions.

## Active Subtrees

- `web/` — active Svelte 5 + SvelteKit frontend
- `mint/` — Rust mint workspace and deployment assets
- `docs/` — canonical product, design, technical, business, and planning docs

## Start Here

- [`docs/README.md`](docs/README.md)
- [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md)
- [`docs/design/product-decisions.md`](docs/design/product-decisions.md)

## Development

Frontend:

```bash
cd web
bun install
bun run dev
```

Mint:

```bash
cd mint
cargo build
```

The repo root is for shared docs, planning, and agent instructions. It is not an application runtime.
