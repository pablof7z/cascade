# Cascade

Repository layout:

- `web/` - active Svelte 5 + SvelteKit frontend under construction.
- failed `webapp/` migration removed from the repo; historical frontend context lives in `docs/archive/`.
- `mint/` - Rust mint workspace and deployment assets.
- `docs/` - product, technical, and business documentation.

Frontend development:

```bash
cd web
bun install
bun run dev
```

Mint development:

```bash
cd mint
cargo build
```

The repo root exists for shared docs, coordination files, and agent instructions. It is not the frontend application root.
