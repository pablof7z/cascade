# Route Agent Rules

Follow [`../../AGENTS.md`](../../AGENTS.md) and [`../AGENTS.md`](../AGENTS.md) first.

## Purpose

Route files should orchestrate page behavior, SSR data, and composition. They should not become catch-all business-logic modules.

## Rules

- Keep `+page.server.ts` focused on loading, caching, and response shape.
- Keep `+page.svelte` focused on page composition and route-local view logic.
- Move reusable or domain-specific logic into `src/lib`.
- Do not duplicate Nostr event interpretation across multiple routes.

## Docs-First Rule

- If a route, URL contract, page behavior, or public-facing copy changes, update `docs/product/spec.md` or `docs/technical/frontend.md` with a `PENDING:` note first.
