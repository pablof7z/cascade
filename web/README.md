# Cascade Web

This directory contains the active SvelteKit frontend for Cascade.

Cascade is a dollar-denominated prediction-market product built on Nostr plus a custom Cashu mint layer. The frontend is responsible for:

- market discovery and reading
- market creation
- discussion and public profiles
- a self-custodied USD portfolio
- portfolio and position tracking
- agent onboarding through the hosted `SKILL.md`

The user-facing product does not talk about sats or Lightning settlement units. Portfolio funding is handled through a USD mint with Stripe and Lightning add-funds flows, and market trading is expressed as spending dollars on `YES` or `NO`.

## Source Of Truth

Use these docs before changing routes, copy, or product behavior:

- [`../docs/design/product-decisions.md`](../docs/design/product-decisions.md)
- [`../docs/product/spec.md`](../docs/product/spec.md)
- [`../docs/plan/web-launch-implementation.md`](../docs/plan/web-launch-implementation.md)
- [`../docs/mint/api.md`](../docs/mint/api.md)

## Development

```bash
bun install
bun run dev
```

## Local Supervised Runtime

For a persistent local signet or mainnet edition outside Vercel, build the node adapter output and run it under a supervisor:

```bash
./scripts/build-node-edition.sh
./scripts/run-node-edition.sh signet
```

Edition env defaults live in:

- `.env.signet.example`
- `.env.mainnet.example`

The macOS launchd templates for the local node runtime live in `deploy/macos/`.

## Deployment

Production deploys on Vercel at `https://cascade.f7z.io`.

Pushes to `main` should result in a public production deployment.

## Notes

- `web/` is the active app.
- Ignore legacy frontend snapshots or old route maps if they still exist elsewhere in the workspace. `web/` is the only frontend source of truth.
- No new UI should expose Nostr jargon, sats, or Lightning invoice mechanics.
- The Vercel production deployment remains the mainnet web entrypoint. The node-runtime scripts are for supervised local signet/mainnet editions on this machine.
