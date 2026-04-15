# Web Agent Rules

Follow the repo root [`AGENTS.md`](../AGENTS.md) first.

## Scope

`web/` is the active Cascade frontend. Treat it as product code, not a generic Svelte template.

## Fundamentals

- Keep the normal UX dollar-denominated.
- `/portfolio` is the capital surface. Do not introduce `/wallet` as a product route.
- Do not expose Nostr jargon in normal UI.
- No loading spinners.
- Keep route files thin and move reusable logic into `src/lib`.

## Docs-First Rule

- Before changing route behavior, product UX, copy, or machine-interface expectations, update the affected canonical doc with a `PENDING:` note first.
- Finish by removing the `PENDING:` note and leaving the doc accurate.

## Read Before Editing

- [`../docs/product/spec.md`](../docs/product/spec.md)
- [`../docs/technical/frontend.md`](../docs/technical/frontend.md)
- [`../docs/plan/web-launch-implementation.md`](../docs/plan/web-launch-implementation.md)
- [`../docs/design/style-guide.md`](../docs/design/style-guide.md)
- [`../docs/mint/api.md`](../docs/mint/api.md)
