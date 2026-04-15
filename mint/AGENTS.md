# Mint Agent Rules

Follow the repo root [`AGENTS.md`](../AGENTS.md) first.

## Scope

- `crates/cascade-core` = shared market and LMSR logic
- `crates/cascade-api` = HTTP surface
- `crates/cascade-mint` = binary and service wiring

## Fundamentals

- Keep mint changes backward-compatible unless the user asks for a breaking change.
- The mint is the authority for trade execution and exit pricing.
- Do not reintroduce close, oracle, or resolution semantics.
- Update migrations, config examples, and docs together when storage or runtime behavior changes.

## Docs-First Rule

- Before changing mint routes, storage, funding behavior, or trade semantics, update the affected canonical doc with a `PENDING:` note first.
- Finish by removing the `PENDING:` note and leaving the doc accurate.

## Read Before Editing

- [`README.md`](README.md)
- [`DEPLOYMENT.md`](DEPLOYMENT.md)
- [`../docs/mint/index.md`](../docs/mint/index.md)
- [`../docs/mint/api.md`](../docs/mint/api.md)
- [`../docs/design/product-decisions.md`](../docs/design/product-decisions.md)
