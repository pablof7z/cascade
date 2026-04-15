# NDK Agent Rules

Follow [`../../../AGENTS.md`](../../../AGENTS.md) and [`../../AGENTS.md`](../../AGENTS.md) first.

## Purpose

This subtree owns NDK setup, session behavior, event adapters, and Nostr-specific rendering helpers.

## Rules

- Keep direct NDK and Nostr protocol concerns here.
- Prefer small helpers over duplicating tag parsing across the app.
- Keep low-level client setup lean.
- Do not casually mix product logic into low-level registry primitives.

## Docs-First Rule

- If event interpretation or Nostr-facing behavior changes, update the relevant canonical doc with a `PENDING:` note first, usually `docs/technical/nostr-events.md` or `docs/technical/frontend.md`.
