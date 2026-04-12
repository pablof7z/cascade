# AGENTS

This subtree owns route composition.

## Purpose

Route files should orchestrate page-level behavior, compose components, and connect SSR data with client interactivity.

## Rules

- Keep `+page.server.ts` focused on loading, caching headers, and route response shape.
- Keep `+page.svelte` focused on page composition and route-local view logic.
- If route logic is reusable or domain-specific, move it into `src/lib`.
- Avoid turning route files into catch-all business-logic modules.
- Do not parse Nostr tags or event semantics inline in multiple routes if the logic may be reused. Move that to `src/lib/ndk` or `src/lib/server`.
- Do not let route files become the place where session, caching, or publishing policy is decided.

## Growth Rules

- When a route grows into a full product surface, create route-local support modules before adding another nested `AGENTS.md`.
- Keep naming and URL structure predictable.
