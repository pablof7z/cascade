# Server Lib Agent Rules

Follow [`../../../AGENTS.md`](../../../AGENTS.md) and [`../../AGENTS.md`](../../AGENTS.md) first.

## Purpose

This subtree is server-only. Put SSR fetch helpers, OG generation, caching, and non-browser relay access here.

## Rules

- Do not import browser-only APIs or UI components here.
- Keep network access, caching, and timeout policy centralized here when possible.
- Prefer server helpers here over embedding fetch logic in route files.
- Keep return shapes stable for route loaders.

## Docs-First Rule

- If server data contracts, caching behavior, or OG behavior change in a way that affects docs, update the nearest canonical doc with a `PENDING:` note first, usually `docs/technical/frontend.md`.
