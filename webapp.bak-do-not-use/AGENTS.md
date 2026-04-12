# Webapp Agent Notes

This subtree contains the SvelteKit frontend. Follow the repository root `AGENTS.md` first, then apply the constraints here when working under `webapp/`.

## Scope

- `src/` contains the application code, routes, components, and tests.
- `api/` contains the local/Vercel endpoint shims used by the frontend.
- `static/` contains public assets served by the app.

## Working Rules

- Keep changes in Svelte and TypeScript; do not reintroduce React code or React-era patterns.
- Preserve the existing route structure and event-driven data flow.
- Keep frontend config files in this directory so the app remains self-contained.
- Prefer focused edits that keep the app runnable from `webapp/` without extra setup.

## Product Guardrails

- Use the repo root terminology rules: mint, withdraw, no oracle, no resolution language.
- Follow the frontend architecture and styling constraints in `docs/technical/frontend.md` and `docs/design/style-guide.md`.
- Keep UI changes aligned with the minimalist dark theme and existing component patterns.

## Reference Files

- `package.json`
- `vite.config.ts`
- `svelte.config.js`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.js`
- `tailwind.config.js`
- `vercel.json`
