# AGENTS

This subtree owns NDK-specific integration.

## Purpose

Use this area for NDK client setup, session behavior, registry-backed primitives, Nostr rendering, and adapters around Nostr event semantics.

## Rules

- Keep direct NDK and Nostr protocol concerns here rather than leaking them into unrelated app modules.
- Prefer adding small adapters and helpers instead of duplicating tag parsing across the codebase.
- Keep the browser client setup in `client.ts` lean and focused on connection/session behavior.
- Treat registry-installed code as infrastructure. Wrap it when needed, but do not casually mix app-specific product logic into low-level registry primitives.

## Growth Rules

- If multiple routes share the same event interpretation logic, move it into this subtree.
- If rendering behavior depends on Nostr event kinds or tags, this subtree is the default home unless it is strictly route-local.
