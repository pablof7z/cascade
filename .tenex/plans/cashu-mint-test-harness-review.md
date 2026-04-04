# Cashu Mint Test Harness — Review Summary

**Status:** [CHANGES_REQUESTED]

## Quick Take

✅ **Architecture is sound.** The plan correctly ports LMSR math from TypeScript, defines 4 comprehensive test engines (stochastic, whale, solvency, edge cases), and lays out a realistic 6-phase roadmap.

❌ **3 blocking assumptions + 3 major config gaps** must be resolved before Phase 1 starts.

---

## Blocking Issues

| Issue | Impact | Fix Effort |
|---|---|---|
| **No protocol versioning** | Harness breaks if Cashu spec changes; silent failures | Add `protocol.spec_version` to config, validate on `/mint` | 2h |
| **Floating-point precision untested** | Rounding errors accumulate (1M trades = 1M operations); false solvency violations possible | Phase 1: add stability tests vs. TypeScript reference (50+ vectors) | 4h |
| **Solvency validated only at HTTP level** | Test passes locally but mint could be insolvent in reality (mint bug) | Post-whale/edge case: attempt redemption of ALL shares to validate end-to-end | Phase 4+ |

---

## Major Config Gaps

1. **No retry/rate-limit strategy** → Harness will either be slow (safe but slow) or aggressive (risk DDOS)
   - **Fix:** Add `mint.max_retries`, `mint.retry_backoff_seconds`, `engine.rate_limit_trades_per_second`

2. **Keyset resolution underspecified** → Phase 4 integration will fail ("which keyset do I mint to?")
   - **Fix:** Clarify keyset ID convention (e.g., `<market_id>_long`), add explicit routing in `MintAPI`

3. **Edge case concurrency test vague** → Doesn't clarify invariant (no double-spend? no data loss? both?)
   - **Fix:** Define precisely: "Two clients redeem same proof concurrently; exactly one succeeds"

---

## Recommendations by Phase

| Phase | Status | Notes |
|---|---|---|
| **1 (Foundation)** | 🟡 Proceed with fixes | Add protocol versioning, precision tests, expanded config schema. Delegate to mint-engineer: LMSR port sign-off, fee accounting, precision spec, keyset naming |
| **2 (Engines)** | ✅ Proceed | Define concurrency invariant explicitly; add whale recovery threshold |
| **3 (Reporting)** | ✅ Proceed | Specify HTML library (Jinja2) + charting (inline SVG) |
| **4 (CLI)** | 🔴 DEFER | Wait for testnet mint deployment + reachability |
| **5 (CI/CD)** | ✅ After Phase 4 | Looks good |
| **6 (Advanced)** | 🟡 Optional | Nice-to-have; do only if MVP is stable |

---

## Questions for mint-engineer

1. Are LMSR formulas (sec 2.2) identical to Rust CDK? Any edge cases?
2. When is 2% rake applied? (Trade time or settlement?) Does it affect solvency math?
3. Is `/reserve` endpoint exposed? Or validate solvency by redemption testing?
4. Is BLS/DLEQ verification required? (Or skip for performance?)
5. What's the keyset ID convention? (e.g., `<market_id>_long`?)
6. What Cashu spec version does the Rust CDK target?
7. What's the acceptable trade throughput? (e.g., 10 TPS, 100 TPS?)
8. What precision does the mint use for fees? (Sats, millisats, fixed-point?)

---

## Final Verdict

**✅ APPROVE to Phase 1 IF:**
- Blocking issues #1–#2 are resolved in Phase 1 scope
- mint-engineer answers the 8 questions above
- Config schema is expanded (retry, rate-limit, keyset resolution)

**Timeline Estimate:** 2–3 weeks for production-ready harness (Phases 1–5).

---

For full details, see `/Users/customer/.tenex/home/d5098b5c/projects/cascade-8f3k2m/docs/+cashu-mint-test-harness-review.md`
