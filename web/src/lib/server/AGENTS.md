# AGENTS

This subtree is server-only.

## Purpose

Put SSR data loading support, OG generation, and other non-browser Nostr access here.

## Rules

- Do not import browser-only APIs or UI components here.
- Keep network access, relay access, caching, and timeout policy centralized here when possible.
- Prefer adding new fetch helpers here instead of embedding server-fetch logic inside route files.
- Keep return shapes stable and predictable for route loaders.
- If caching behavior changes, document the intended scope in code comments.

## Boundaries

- `nostr.ts`: server data access and cache behavior
- `og.ts`: image generation and OG presentation helpers
