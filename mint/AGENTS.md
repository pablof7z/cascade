# Cascade Mint Agent Notes

This subtree is the Rust mint workspace. Follow the repository root `AGENTS.md` as the baseline, then apply the constraints here when working under `mint/`.

## Scope

- `crates/cascade-core` contains shared market and LMSR logic.
- `crates/cascade-api` contains the HTTP surface.
- `crates/cascade-mint` contains the mint binary and service wiring.

## Working Rules

- Keep mint changes backward-compatible unless the user explicitly asks for a breaking change.
- Update migrations, config examples, and docs together when changing storage or runtime configuration.
- Prefer targeted edits over broad refactors. Keep code paths and API shapes stable.
- Run the relevant Rust checks after changes when possible, especially `cargo fmt` and the smallest useful test command.

## Product Guardrails

- Do not use forbidden market terminology from the repo root instructions.
- Markets do not close, there is no oracle, and there is no resolution step.
- The mint is the authority for trade execution and withdrawal pricing.

## Reference Files

- `README.md`
- `DEPLOYMENT.md`
- `.env.example`
- `config.toml.example`
- `migrations/`
