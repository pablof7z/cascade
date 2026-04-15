# Auth Agent Rules

Follow [`../../../../AGENTS.md`](../../../../AGENTS.md) and [`../../../AGENTS.md`](../../../AGENTS.md) first.

## Purpose

This subtree owns sign-in flows, session-entry UI, and authenticated topbar actions.

## Rules

- Keep auth orchestration here, not in routes or generic UI folders.
- Keep components small and split by auth state or login mode.
- Keep styling local to this subtree instead of `src/app.css`.
- Onboarding can route out of auth, but onboarding logic should not live here.

## Docs-First Rule

- If sign-in, session-entry, or identity-bootstrap behavior changes, update the relevant canonical doc with a `PENDING:` note first, usually `docs/technical/authentication.md` or `docs/product/spec.md`.
