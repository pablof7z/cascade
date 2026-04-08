# Phase 0: Third-Party Mint Integration

## Goal

Validate the entire user-facing wallet flow (deposit, hold balance, withdraw) with real satoshis using an established third-party Cashu mint. This phase carries minimal financial risk because the mint operator (not Cascade) handles Lightning custody.

## Mint Selection

**Recommended: Use a public Nutshell mint (e.g., mint.minibits.cash or mint.coinos.io)**

| Criteria | Nutshell Public Mint | Self-hosted Nutshell |
|---|---|---|
| Setup effort | Zero — just point wallet at URL | Moderate — need server + Lightning node |
| Operational risk to us | None — mint operator's problem | We own uptime |
| Trust model | Trust the mint operator | We are the mint operator |
| Cost | Free (mint operator absorbs fees) | Server + Lightning channel costs |
| Best for | Phase 0 validation | Phase 0.5 if we want more control |

For Phase 0, a public Nutshell mint is ideal because the goal is wallet UX validation, not mint operations.

**Fallback**: If public mint reliability is poor, deploy a Nutshell instance ourselves on a $10/mo VPS. This is still "third-party" in the sense that it's standard Nutshell, not our custom cascade-mint.

## File Changes

### `src/lib/config.ts` (or equivalent config location)
- **Action**: Modify
- **What**: Add a `MINT_URL` configuration that points to the third-party mint URL. Make it environment-variable driven so it can be switched without code changes.
- **Why**: Decouples mint selection from application code. Enables easy switching between Phase 0 (third-party) and Phase 2 (custom mint).

### `src/lib/stores/walletStore.ts` (or NIP-60 wallet integration)
- **Action**: Modify
- **What**: Ensure the NIP-60 wallet initialization uses the configurable `MINT_URL` instead of any hardcoded value. Verify that `CashuMint` and `CashuWallet` from `@cashu/cashu-ts` are instantiated with this URL.
- **Why**: The wallet must point to the third-party mint for deposits and withdrawals.

### `src/lib/components/WalletBalance.svelte`
- **Action**: Modify
- **What**: 
  - Display which mint the wallet is connected to (show mint URL or friendly name)
  - Add deposit flow: user taps "Deposit" → app requests a Lightning invoice from the mint (NUT-04: mint tokens) → user pays invoice → ecash tokens minted and stored in NIP-60 wallet
  - Add withdraw flow: user taps "Withdraw" → user provides Lightning invoice → app melts tokens via mint (NUT-05: melt tokens) → sats sent to user's invoice
  - Show pending/confirmed states for deposits and withdrawals
- **Why**: Core UX that must work before any trading flow can use real sats.

### `src/lib/components/DepositFlow.svelte`
- **Action**: Create
- **What**: New component encapsulating the NUT-04 mint flow:
  1. User enters amount (sats)
  2. App calls mint's `/v1/mint/quote/bolt11` to get a Lightning invoice
  3. App displays invoice as QR + copy-pasteable string
  4. App polls `/v1/mint/quote/bolt11/{quote_id}` for payment status
  5. On payment confirmed, app calls `/v1/mint/bolt11` with blinded messages to receive ecash
  6. Ecash stored in NIP-60 wallet (kind 7375/7376 events)
- **Why**: Deposit is the first step in the real-money funnel. Must be smooth and reliable.

### `src/lib/components/WithdrawFlow.svelte`
- **Action**: Create
- **What**: New component encapsulating the NUT-05 melt flow:
  1. User enters amount and provides a Lightning invoice (or generates one from their external wallet)
  2. App calls mint's `/v1/melt/quote/bolt11` with the invoice to get fee estimate
  3. User confirms (seeing amount + fees)
  4. App calls `/v1/melt/bolt11` with ecash proofs to melt
  5. App updates NIP-60 wallet state (remove spent proofs)
- **Why**: Withdraw is the escape hatch. Users must always be able to exit.

### `src/lib/services/cashuService.ts`
- **Action**: Create or Modify (if partial implementation exists)
- **What**: Service layer wrapping `@cashu/cashu-ts` operations:
  - `requestMintQuote(amount: number): Promise<MintQuote>` — NUT-04 quote
  - `mintTokens(quote: MintQuote, blindedMessages: BlindedMessage[]): Promise<Token[]>` — NUT-04 mint
  - `requestMeltQuote(invoice: string): Promise<MeltQuote>` — NUT-05 quote
  - `meltTokens(quote: MeltQuote, proofs: Proof[]): Promise<MeltResponse>` — NUT-05 melt
  - `checkProofState(proofs: Proof[]): Promise<ProofState[]>` — NUT-07 state check
- **Why**: Centralizes all Cashu protocol interactions. Makes mint-switching trivial.

### Terms of Service / Risk Disclosure
- **Action**: Create
- **What**: A simple page or modal (`/terms` or inline) disclosing:
  - This is a beta product
  - Funds held in a third-party Cashu mint (link to mint operator)
  - No guarantee of fund recovery if mint goes offline
  - Deposit limits apply (suggest 10,000 sats max per user in Phase 0)
- **Why**: Even with a third-party mint, users must understand the risk. Also establishes the pattern for more comprehensive terms in Phase 2.

## Execution Order

1. **Configure mint URL** — Add `MINT_URL` to config, verify it's environment-switchable. Verify by logging the URL at startup.

2. **Implement cashuService.ts** — Build the Cashu protocol wrapper using `@cashu/cashu-ts`. Verify by unit-testing each method against the third-party mint's API (or a local Nutshell instance).

3. **Build DepositFlow.svelte** — Implement NUT-04 mint flow with QR display and polling. Verify by depositing 100 test sats and confirming ecash appears in NIP-60 wallet.

4. **Build WithdrawFlow.svelte** — Implement NUT-05 melt flow. Verify by withdrawing the 100 sats deposited in step 3 to a Lightning wallet.

5. **Update WalletBalance.svelte** — Show real balance from NIP-60 proofs, mint indicator, deposit/withdraw entry points. Verify by checking balance updates after deposit and withdrawal.

6. **Add risk disclosure / terms** — Create the beta terms page/modal. Verify it displays before first deposit.

7. **End-to-end smoke test** — Full flow: deposit sats → see balance → withdraw sats → balance returns to zero. Test with 2-3 different Lightning wallets (Phoenix, Alby, Wallet of Satoshi).

## Phase 0 Go/No-Go Gates

Before proceeding to Phase 1:

- [ ] Deposit flow works reliably (>95% success rate over 20+ test transactions)
- [ ] Withdraw flow works reliably (>95% success rate)
- [ ] NIP-60 wallet state persists correctly across page reloads and re-logins
- [ ] Balance display is accurate (matches actual proof values)
- [ ] Risk disclosure is displayed to users
- [ ] At least 5 distinct users have tested the flow (team + friends)
- [ ] No ecash token loss incidents during testing
- [ ] Error states are handled gracefully (invoice expired, insufficient balance, mint offline)

## Limitations of Phase 0

- **No trading**: This phase is wallet-only. Trading still uses play money (CAS tokens). Real sats sit in the wallet but can't be used to buy market positions yet.
- **No custom LMSR**: The third-party mint has no concept of LMSR or market keysets. Trading integration requires the custom mint.
- **Custody risk**: Users' sats are custodied by the third-party mint operator. Cascade has zero control or recourse if the mint operator disappears.
- **No fee revenue**: Cascade earns nothing from deposits/withdrawals on a third-party mint.
