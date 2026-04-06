# UI Flow — Resolution Interface

## File Changes

### `src/routes/m/[slug]/+page.svelte`
- **Action**: modify
- **What**:
  - Add resolution banner at top of market detail page when `market.resolution` is set
  - Disable trading controls when market is resolved
  - Show "Resolve Market" button for market creator (when authenticated, market is active, creator matches pubkey)
  - Wire button to open `ResolveMarketModal`
  - Handle VOID outcome display in banner
- **Why**: Primary surface for resolution visibility and creator action

#### Resolution Banner

```svelte
{#if market.resolution}
  <div class="border-b border-neutral-800 px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Resolved</span>
        {#if market.resolution === 'YES'}
          <span class="text-lg font-semibold text-emerald-400">YES</span>
        {:else if market.resolution === 'NO'}
          <span class="text-lg font-semibold text-rose-400">NO</span>
        {:else if market.resolution === 'VOID'}
          <span class="text-lg font-semibold text-neutral-400">VOID</span>
        {/if}
      </div>
      <span class="text-xs text-neutral-500">
        {formatTimestamp(market.resolvedAt)}
      </span>
    </div>
    {#if market.resolution === 'VOID'}
      <p class="mt-1 text-xs text-neutral-500">All positions refunded at cost basis minus platform fee.</p>
    {/if}
  </div>
{/if}
```

#### Creator Resolve Button

```svelte
{#if isCreator && !market.resolution && isAuthenticated}
  <button
    class="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
    onclick={() => showResolveModal = true}
  >
    Resolve Market
  </button>
{/if}
```

### `src/lib/components/ResolveMarketModal.svelte`
- **Action**: create
- **What**: Modal component for market resolution with outcome selection, note field, confirmation flow
- **Why**: Dedicated UI for the resolution action with safety confirmations

#### Modal Design

**Container**: `fixed inset-0 z-50 flex items-center justify-center bg-black/60`  
**Panel**: `w-full max-w-md bg-neutral-900 border border-neutral-800 p-6` (no rounded pills per style guide)

**Layout**:
1. **Header**: "Resolve Market" — `text-lg font-semibold text-white`
2. **Market title echo**: `text-sm text-neutral-400 mb-6` — shows market question for confirmation
3. **Outcome selection**: Three buttons in a row
4. **Resolution note**: Optional textarea
5. **Confirm button**: Conditional on outcome selection
6. **Error display**: Below confirm button

#### Outcome Selection

```svelte
<div class="flex gap-2">
  <button
    class={selectedOutcome === 'YES'
      ? 'flex-1 border border-emerald-500 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-400'
      : 'flex-1 border border-neutral-700 py-3 text-sm font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'}
    onclick={() => selectedOutcome = 'YES'}
  >
    YES
  </button>
  <button
    class={selectedOutcome === 'NO'
      ? 'flex-1 border border-rose-500 bg-rose-500/10 py-3 text-sm font-medium text-rose-400'
      : 'flex-1 border border-neutral-700 py-3 text-sm font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'}
    onclick={() => selectedOutcome = 'NO'}
  >
    NO
  </button>
  <button
    class={selectedOutcome === 'VOID'
      ? 'flex-1 border border-neutral-500 bg-neutral-500/10 py-3 text-sm font-medium text-neutral-400'
      : 'flex-1 border border-neutral-700 py-3 text-sm font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'}
    onclick={() => selectedOutcome = 'VOID'}
  >
    VOID
  </button>
</div>
```

#### Resolution Note (with hint — M6)

```svelte
<div class="mt-4">
  <label class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
    Resolution Note
  </label>
  <textarea
    bind:value={resolutionNote}
    class="mt-1 w-full bg-neutral-950 border border-neutral-800 p-3 text-sm text-white placeholder:text-neutral-600 resize-none"
    rows="3"
    placeholder="Explain your reasoning (optional)"
  />
  <p class="mt-1 text-xs text-neutral-600">
    Adding context helps the community understand your decision.
  </p>
</div>
```

#### Confirm Button States

```svelte
<!-- No outcome selected -->
{#if !selectedOutcome}
  <button disabled class="mt-6 w-full py-3 text-sm font-medium text-neutral-600 bg-neutral-800 cursor-not-allowed">
    Select an outcome
  </button>

<!-- Ready to confirm (first click) -->
{:else if !confirming}
  <button
    class="mt-6 w-full py-3 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 transition-colors"
    onclick={() => confirming = true}
  >
    Resolve as {selectedOutcome}
  </button>

<!-- Confirmation step (second click) -->
{:else if !submitting}
  <div class="mt-6 space-y-2">
    <p class="text-xs text-rose-400 text-center">
      {#if selectedOutcome === 'VOID'}
        This will refund all positions at cost basis minus fee. This cannot be easily undone.
      {:else}
        This will pay out all {selectedOutcome} position holders. This cannot be easily undone.
      {/if}
    </p>
    <div class="flex gap-2">
      <button
        class="flex-1 py-3 text-sm font-medium text-neutral-400 border border-neutral-700 hover:text-white transition-colors"
        onclick={() => { confirming = false; }}
      >
        Cancel
      </button>
      <button
        class="flex-1 py-3 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-600 transition-colors"
        onclick={handleConfirm}
      >
        Confirm {selectedOutcome}
      </button>
    </div>
  </div>

<!-- Submitting -->
{:else}
  <button disabled class="mt-6 w-full py-3 text-sm font-medium text-neutral-400 bg-neutral-800 cursor-not-allowed">
    Resolving...
  </button>
{/if}
```

#### Error Handling

```svelte
{#if error}
  <div class="mt-4 border border-rose-500/20 bg-rose-500/5 p-3">
    <p class="text-xs text-rose-400">{error}</p>
    {#if error.includes('Another tab')}
      <p class="mt-1 text-xs text-neutral-500">Close other tabs and try again.</p>
    {:else if error.includes('insufficient')}
      <p class="mt-1 text-xs text-neutral-500">The vault doesn't have enough funds to cover all payouts.</p>
    {:else if error.includes('deleted')}
      <p class="mt-1 text-xs text-neutral-500">This market has been deleted and cannot be resolved.</p>
    {/if}
  </div>
{/if}
```

#### Confirm Flow

```typescript
async function handleConfirm() {
  submitting = true;
  error = null;
  try {
    const outcomePrice = selectedOutcome === 'YES' ? 1.0 : selectedOutcome === 'NO' ? 0.0 : 0.0;
    const result = await resolveMarket(market, selectedOutcome, outcomePrice, resolutionNote);
    if (result.success) {
      showResolveModal = false;
      // Market object updated via subscription — banner appears automatically
    } else {
      error = result.error.message;
      confirming = false; // Reset to allow retry
    }
  } catch (err) {
    error = err.message;
    confirming = false;
  } finally {
    submitting = false;
  }
}
```

### `src/routes/m/[slug]/+page.svelte` — Positions Tab Payout Display
- **Action**: modify (within existing Positions tab)
- **What**: After resolution, show per-position payout amount next to each position entry
- **Why**: Users need to see what they received or will receive

```svelte
{#if market.resolution}
  <div class="flex items-center gap-2">
    {#if payout > 0}
      <span class="text-sm font-mono text-emerald-400">+{payout} sats</span>
    {:else if market.resolution === 'VOID'}
      <span class="text-sm font-mono text-neutral-400">Refunded</span>
    {:else}
      <span class="text-sm font-mono text-neutral-500">No payout</span>
    {/if}
  </div>
{/if}
```

## Execution Order

1. **Create `ResolveMarketModal.svelte`** — Full modal with three outcome buttons (YES/NO/VOID), resolution note with hint text, two-step confirmation, error display. Verify: component renders without errors, type-check passes.
2. **Add resolution banner to `+page.svelte`** — Conditional banner at top when `market.resolution` is set. Handles YES (emerald), NO (rose), VOID (neutral) styling. Verify: banner appears with mock data.
3. **Add creator resolve button** — Conditional on `isCreator && !market.resolution && isAuthenticated`. Opens modal on click. Verify: button visible for creator, hidden for others.
4. **Disable trading when resolved** — Conditionally disable buy/sell controls when `market.resolution` is truthy. Verify: trading controls disabled after resolution.
5. **Add payout display to positions tab** — Show per-position payout amount using `calculatePayout()`. Verify: correct amounts shown for winners, "No payout" for losers, "Refunded" for VOID.
6. **Wire modal to `resolveMarket()`** — Connect confirm handler to service layer. Handle success (close modal), partial failure (show error, allow retry), and multi-tab lock error. Verify: end-to-end flow works.
7. **Handle VOID-specific UX** — VOID banner shows refund explanation, confirmation warns about refund behavior, payout display shows "Refunded". Verify: VOID flow distinct from YES/NO.
