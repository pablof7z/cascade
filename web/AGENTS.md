# AGENTS

This file defines repo-wide rules. Nested `AGENTS.md` files override or refine these rules for their subtree.

## Purpose

This repository is a SvelteKit + NDK template for building real Nostr applications.

The example product surfaces in this repo include profiles, notes, articles, comments, highlights, login, and onboarding. Treat those as demonstrations of the app foundation, not as hard product boundaries.

## Global Rules

- After each user-requested fix or UI adjustment, commit the change and deploy it unless the user explicitly says not to.
- Prefer small, composable modules over adding more logic to route files.
- Keep server-only code out of client modules and UI components.
- Keep NDK integration concerns isolated from product copy and presentation concerns.
- Do not add new global styling to `src/app.css` if the change can live beside the component or be scoped to a smaller styling surface.
- Add nested `AGENTS.md` files sparingly. Only create one when a subtree has non-obvious architectural rules that are worth preserving.

## Preferred Boundaries

- `src/routes`: route orchestration, route-local loading, and page composition.
- `src/lib/server`: server-only data fetching, OG generation, caching policy, and other non-browser concerns.
- `src/lib/ndk`: NDK clients, adapters, registry primitives, and Nostr-specific rendering/integration code.
- `src/lib/components`: reusable app-level components. Keep them presentation-first.
- `src/lib/components/ui`: reusable low-level UI primitives. Keep them generic.

## Quality Bar

- Prefer feature growth through new modules instead of inflating already-large files.
- Add or preserve clear separation between SSR data loading and client subscriptions.
- Avoid broad cross-cutting edits unless the task actually requires them.
- If a subtree starts to accumulate rules or repeated patterns, update its nearest `AGENTS.md`.
