# AGENTS

This subtree owns authentication and session-entry UI.

## Purpose

Keep signer login flows, session-entry UX, and authenticated topbar actions isolated from route files and generic components.

## Rules

- Put auth orchestration here, not in `src/routes` or generic component folders.
- Keep components small: split by login mode or auth state instead of rebuilding a large panel component.
- Keep styling for auth surfaces in this subtree instead of `src/app.css`.
- Do not move onboarding publishing logic here; auth can route into onboarding, but onboarding owns profile setup.
