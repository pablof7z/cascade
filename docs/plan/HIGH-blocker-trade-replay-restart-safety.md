# HIGH BLOCKER: Trade Replay Not Restart-Safe After Proof Issuance

*Added: 2026-04-13 — Review 2 findings (clean-code-nazi, conv: bc549b53a4)*
*Status: OPEN — fix delegated to coder*

## The Problem

In both buy and sell trade paths, blind signatures are issued and committed to the mint store **before** trade snapshots and request-replay metadata are persisted to the database. If the daemon restarts between these two steps, value is stranded:

- The client may not receive the issued/change bundles
- The request row stays in `pending` state
- In sell flows, the generated wallet quote id is not durably surfaced to the client

**Severity:** HIGH — blocks launch.

## Root Cause

The execution order in both paths is wrong:

### Buy path
```
settlement executes → blind-sign outputs → PERSIST snapshots/request-replay ← WRONG
```
Should be:
```
settlement executes → PERSIST snapshots/request-replay → blind-sign outputs
```

### Sell path
```
issue wallet outputs/change → PERSIST settlement metadata/request-replay ← WRONG
```
Should be:
```
PERSIST settlement metadata/request-replay → issue wallet outputs/change
```

## Files Affected

- `mint/crates/cascade-api/src/handlers/product.rs`
  - Buy path: lines ~3424-3569 (blind-signing before snapshot persistence)
  - Sell path: lines ~3851-3996 (output issuance before settlement persistence)
  - Signing helper: lines ~849-906
  - Swap/sign helper: lines ~908-1020
- `mint/crates/cascade-core/src/db.rs`
  - `apply_trade_execution_snapshots()`: lines ~2605-2633
  - `complete_trade_execution_request()`: lines ~3085-3096

## The Fix

**Invert the order in both paths: persistence BEFORE proof issuance.**

For buy path:
1. Execute settlement
2. Apply trade execution snapshots (`apply_trade_execution_snapshots()`)
3. Complete request (`complete_trade_execution_request()`)
4. THEN blind-sign market outputs
5. THEN return signed outputs to client

For sell path:
1. Execute settlement (or prepare wallet quote)
2. Persist settlement metadata + request-replay (`complete_trade_execution_request()`)
3. THEN issue wallet outputs/change
4. THEN return to client

**Key invariant:** If `apply_trade_execution_snapshots()` + `complete_trade_execution_request()` has been called, a restart will find the request as `pending` and the existing rollback/idempotency logic in `product.rs:3085-3096` will handle replay correctly — it won't re-issue signatures.

**No change needed to rollback logic** — the existing check (`pending` status before re-execution) is correct. The fix is purely sequencing.

## Verification

After the fix:
- `cargo test -p cascade-api --test api_integration` (full suite)
- Specifically re-run the idempotency tests:
  - `test_trade_request_id_is_idempotent`
  - `test_lightning_funding_request_id_is_idempotent`
- Add a new test: daemon restart between snapshot persistence and signing → request replays correctly on restart, no double-signature

## Ship Criteria

- [ ] Buy path: snapshots persisted before blind-signing
- [ ] Sell path: settlement metadata persisted before wallet output issuance
- [ ] All `cargo test -p cascade-api --test api_integration` pass
- [ ] Idempotency tests pass
- [ ] `cargo check -p cascade-api` clean
- [ ] Commit with message: `fix(mint): persist snapshots before proof issuance for restart-safety`
- [ ] Push to `round-4-m7-m8`
- [ ] Review 3 by clean-code-nazi clears this finding
