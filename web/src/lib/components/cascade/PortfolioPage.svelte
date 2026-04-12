<script lang="ts">
  import { browser } from '$app/environment';
  import {
    createLightningTopupQuote,
    fetchPortfolioMirror,
    fetchWalletTopupRequestStatus,
    fetchWalletTopupStatus,
    parseJson,
    settleLightningTopupQuote,
    type ProductFundingEvent,
    type ProductProof,
    type ProductWallet,
    type ProductWalletFundingExecution,
    type ProductWalletTopup,
    type ProductWalletTopupExecution,
    type ProductWalletTopupRequestStatus
  } from '$lib/cascade/api';
  import { getProductApiUrl, isPaperEdition } from '$lib/cascade/config';
  import { formatUsdMinor } from '$lib/cascade/format';
  import {
    attachPendingTopupId,
    clearPendingTopup,
    listPendingTopups,
    markPendingTopupNotified,
    trackPendingTopup
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';
  import { addLocalProofs, listLocalProofs, localProofBalance } from '$lib/wallet/localProofs';

  type PaperWallet = ProductWallet & {
    funding_events: ProductFundingEvent[];
  };

  const currentUser = $derived(ndk.$currentUser);
  const paperEdition = isPaperEdition();
  const editionLabel = paperEdition ? 'Signet' : 'Mainnet';
  const portfolioLabel = paperEdition ? 'signet portfolio' : 'portfolio';

  const proofUnit = 'usd';
  const paperFaucetSingleLimitMinor = 10000;
  const paperFaucetWindowLimitMinor = 25000;

  let wallet = $state<PaperWallet | null>(null);
  let loading = $state(false);
  let errorMessage = $state('');
  let status = $state('');
  let faucetAmount = $state('10000');
  let lightningAmount = $state('2500');
  let localBalanceMinor = $state(0);
  let localProofCount = $state(0);

  function proofMintUrl(): string {
    return getProductApiUrl().replace(/\/+$/, '');
  }

  function refreshLocalProofSummary() {
    const mintUrl = proofMintUrl();
    localBalanceMinor = localProofBalance(mintUrl, proofUnit);
    localProofCount = listLocalProofs(mintUrl, proofUnit).length;
  }

  async function loadWallet() {
    if (!currentUser) return;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetchPortfolioMirror(currentUser.pubkey);
      wallet = await parseJson<PaperWallet>(response, 'Failed to load your market mirror.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load your market mirror.';
    } finally {
      loading = false;
    }
  }

  function applyIssuedProofs(proofs: ProductProof[] | null | undefined, sourceLabel: string): boolean {
    if (!proofs?.length) return false;
    const snapshot = addLocalProofs(proofMintUrl(), proofUnit, proofs);
    localBalanceMinor = snapshot.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    localProofCount = snapshot.proofs.length;
    status = `${sourceLabel} added ${formatUsdMinor(proofs.reduce((sum, proof) => sum + proof.amount, 0))} of browser-local proofs.`;
    return true;
  }

  function formatPaperFaucetError(message: string): string {
    if (message.startsWith('paper_faucet_single_topup_limit_exceeded')) {
      return `Paper funding is capped at ${formatUsdMinor(paperFaucetSingleLimitMinor)} per top-up.`;
    }

    if (message.startsWith('paper_faucet_window_limit_exceeded')) {
      return `Paper funding is capped at ${formatUsdMinor(paperFaucetWindowLimitMinor)} per 24 hours.`;
    }

    return message;
  }

  async function addPaperFunds() {
    if (!currentUser) {
      errorMessage = `Sign in before funding your ${portfolioLabel}.`;
      return;
    }

    const amountMinor = Number.parseInt(faucetAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a funding amount greater than zero.';
      return;
    }

    status = `Adding ${formatUsdMinor(amountMinor)} to your ${portfolioLabel}.`;
    errorMessage = '';
    const response = await fetch(`${getProductApiUrl()}/api/product/paper/faucet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pubkey: currentUser.pubkey,
        amount_minor: amountMinor
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      errorMessage = formatPaperFaucetError(payload?.error || 'Paper funding failed.');
      status = '';
      return;
    }

    const payload = (await response.json()) as ProductWalletFundingExecution;
    wallet = payload.wallet as PaperWallet;
    applyIssuedProofs(payload.proofs, 'Paper funding');
  }

  async function createLightningTopup() {
    if (!currentUser) {
      errorMessage = `Sign in before starting a Lightning top-up for your ${portfolioLabel}.`;
      return;
    }

    const amountMinor = Number.parseInt(lightningAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a Lightning top-up amount greater than zero.';
      return;
    }

    status = `Creating a Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';
    const requestId = crypto.randomUUID();
    trackPendingTopup({
      id: requestId,
      requestId,
      pubkey: currentUser.pubkey,
      amountMinor,
      rail: 'lightning'
    });
    try {
      const response = await createLightningTopupQuote({
        pubkey: currentUser.pubkey,
        amountMinor,
        requestId
      });
      const topup = await parseJson<ProductWalletTopup>(response, 'Lightning top-up creation failed.');

      attachPendingTopupId(requestId, topup.id);
      await loadWallet();
      status = `Created a Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lightning top-up creation failed.';
      if (message === 'wallet_topup_request_in_progress') {
        status = `Recovering the Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
      } else {
        errorMessage = message;
        status = '';
      }
    }
  }

  async function settleLightningTopup(topupId: string, amountMinor: number) {
    status = `Completing the signet Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';

    try {
      const response = await settleLightningTopupQuote(topupId);
      const payload = await parseJson<ProductWalletTopupExecution>(
        response,
        'Lightning top-up settlement failed.'
      );
      wallet = payload.wallet as PaperWallet;
      clearPendingTopup(trackedTopupIdForQuote(topupId));
      if (!applyIssuedProofs(payload.topup.issued_proofs, 'Lightning top-up')) {
        status = `Completed the signet Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Lightning top-up settlement failed.';
      status = '';
    }
  }

  async function refreshPendingTopups() {
    status = 'Refreshing pending Lightning top-ups.';
    errorMessage = '';
    await loadWallet();
    await reconcilePendingTopups();
  }

  async function reconcilePendingTopups() {
    if (!currentUser) return;

    const trackedTopups = listPendingTopups(currentUser.pubkey);
    if (!trackedTopups.length) return;

    let walletNeedsRefresh = false;

    for (const trackedTopup of trackedTopups) {
      try {
        let topup: ProductWalletTopup | null = null;

        if (trackedTopup.requestId && !trackedTopup.topupId) {
          const requestResponse = await fetchWalletTopupRequestStatus(trackedTopup.requestId);
          const requestStatus = await parseJson<ProductWalletTopupRequestStatus>(
            requestResponse,
            'Failed to recover the Lightning top-up status.'
          );

          if (requestStatus.status === 'pending') {
            if (!trackedTopup.pendingNotified) {
              status = `Recovered pending Lightning top-up for ${formatUsdMinor(trackedTopup.amountMinor)}.`;
              markPendingTopupNotified(trackedTopup.id);
            }
            continue;
          }

          if (requestStatus.status === 'failed') {
            clearPendingTopup(trackedTopup.id);
            errorMessage = requestStatus.error || 'Lightning top-up creation failed.';
            continue;
          }

          topup = requestStatus.topup || null;
          if (topup?.id) {
            attachPendingTopupId(trackedTopup.id, topup.id);
          }
        }

        if (!topup) {
          const topupId = trackedTopup.topupId ?? trackedTopup.id;
          const response = await fetchWalletTopupStatus(topupId);
          topup = await parseJson<ProductWalletTopup>(
            response,
            'Failed to recover the Lightning top-up status.'
          );
        }

        if (topup.status === 'invoice_pending') {
          if (!trackedTopup.pendingNotified) {
            status = `Recovered pending Lightning top-up for ${formatUsdMinor(topup.amount_minor)}.`;
            markPendingTopupNotified(trackedTopup.id);
          }
          continue;
        }

        clearPendingTopup(trackedTopup.id);
        walletNeedsRefresh = true;

        if (topup.status === 'complete') {
          applyIssuedProofs(topup.issued_proofs, 'Recovered Lightning top-up');
        } else {
          status = `Recovered ${topup.status.replace(/_/g, ' ')} Lightning top-up for ${formatUsdMinor(topup.amount_minor)}.`;
        }
      } catch {
        // Keep tracked topups in storage until the status endpoint is reachable again.
      }
    }

    if (walletNeedsRefresh) {
      await loadWallet();
    }
  }

  $effect(() => {
    if (!browser) return;
    refreshLocalProofSummary();
  });

  $effect(() => {
    if (!browser || !currentUser) return;
    void (async () => {
      refreshLocalProofSummary();
      await loadWallet();
      await reconcilePendingTopups();
    })();
  });

  $effect(() => {
    if (!browser || !currentUser) return;

    const interval = window.setInterval(() => {
      void reconcilePendingTopups();
    }, 5000);

    return () => window.clearInterval(interval);
  });

  function trackedTopupIdForQuote(quoteId: string): string {
    const tracked = listPendingTopups(currentUser?.pubkey || '').find(
      (entry) => entry.topupId === quoteId || (!entry.requestId && entry.id === quoteId)
    );
    return tracked?.id || quoteId;
  }
</script>

<section class="wallet-page">
  <header class="wallet-header">
    <div class="eyebrow">{editionLabel} Portfolio</div>
    <h1>Browser-local proof portfolio</h1>
    <p>
      Portfolio proofs are stored in this browser in both signet and mainnet. The market mirror
      below stays in place temporarily while proof-based trading is migrated to consume proofs
      directly.
    </p>
  </header>

  {#if !currentUser}
    <section class="wallet-panel">
      <h2>Sign in to use your portfolio</h2>
      <p class="muted">
        Funding limits are keyed to your current signing identity. Issued proofs stay in this browser.
      </p>
    </section>
  {:else}
    <section class="wallet-grid">
      <article class="wallet-panel">
        <span class="label">Local Proofs</span>
        <strong>{formatUsdMinor(localBalanceMinor)}</strong>
        <p class="muted">{localProofCount} proofs stored in this browser.</p>
      </article>

      <article class="wallet-panel">
        <span class="label">Market Mirror</span>
        <strong>{formatUsdMinor(wallet?.available_minor ?? 0)}</strong>
        <p class="muted">
          Temporary mirror used by the current market coordinator while proof-based trading is wired in.
        </p>
      </article>
    </section>

    {#if paperEdition}
      <section class="wallet-panel">
        <div class="panel-header">
          <div>
            <h2>Add signet funds</h2>
            <p class="muted">
              Faucet top-ups are signet-only. Limit {formatUsdMinor(paperFaucetSingleLimitMinor)} per
              top-up and {formatUsdMinor(paperFaucetWindowLimitMinor)} per 24 hours.
            </p>
          </div>
        </div>

        <div class="funding-row">
          <label class="field">
            <span>Paper amount</span>
            <input aria-label="Paper amount" bind:value={faucetAmount} min="100" step="100" type="number" />
          </label>
          <button class="button-primary" onclick={addPaperFunds} type="button">Add funds</button>
        </div>
      </section>
    {/if}

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Lightning top-up</h2>
          <p class="muted">
            Create a Lightning invoice to fund browser-local USD proofs.
            {#if paperEdition}
              In signet, you can also complete the top-up locally for paper trading.
            {/if}
          </p>
        </div>
      </div>

      <div class="funding-row">
        <label class="field">
          <span>Lightning amount</span>
          <input
            aria-label="Lightning amount"
            bind:value={lightningAmount}
            min="100"
            step="100"
            type="number"
          />
        </label>
        <button class="button-primary" onclick={createLightningTopup} type="button">
          Create Lightning invoice
        </button>
      </div>

      {#if wallet?.pending_topups?.length}
        <div class="history-list">
          {#each wallet.pending_topups as topup (topup.id)}
            <div class="history-row history-row-stack">
              <div class="history-copy">
                <strong>{formatUsdMinor(topup.amount_minor)}</strong>
                <p class="muted">{topup.rail} · {topup.status} · fx {topup.fx_source}</p>
                {#if topup.invoice}
                  <code>{topup.invoice}</code>
                {/if}
              </div>
              {#if paperEdition}
                <button
                  class="button-secondary"
                  onclick={() => settleLightningTopup(topup.id, topup.amount_minor)}
                  type="button"
                >
                  Complete locally for signet
                </button>
              {:else}
                <button class="button-secondary" onclick={refreshPendingTopups} type="button">
                  Refresh status
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No pending Lightning top-ups.</p>
      {/if}
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Open positions</h2>
          <p class="muted">Current market value and unrealized PnL still come from the temporary market mirror.</p>
        </div>
        <a class="button-secondary" href="/builder">Create market</a>
      </div>

      {#if wallet?.positions?.length}
        <div class="position-list">
          {#each wallet.positions as position (position.market_event_id + position.direction)}
            <a class="position-row" href={`/market/${position.market_slug}`}>
              <div class="position-copy">
                <strong>{position.market_title}</strong>
                <p>{position.direction.toUpperCase()} · {position.quantity.toFixed(2)} shares · {formatProbability(position.current_price_ppm / 1_000_000)}</p>
              </div>
              <div class="position-metrics">
                <span>{formatUsdMinor(position.market_value_minor)}</span>
                <span class:positive={position.unrealized_pnl_minor >= 0} class:negative={position.unrealized_pnl_minor < 0}>
                  {position.unrealized_pnl_minor >= 0 ? '+' : ''}{formatUsdMinor(Math.abs(position.unrealized_pnl_minor))}
                </span>
              </div>
            </a>
          {/each}
        </div>
      {:else if loading}
        <p class="muted">Loading portfolio state.</p>
      {:else}
        <p class="muted">No open positions yet.</p>
      {/if}
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Funding history</h2>
        </div>
      </div>

      {#if wallet?.funding_events?.length}
        <div class="history-list">
          {#each wallet.funding_events as event (event.id)}
            <div class="history-row">
              <div>
                <strong>{formatUsdMinor(event.amount_minor)}</strong>
                <p class="muted">{event.rail} · {event.status}</p>
              </div>
              <span class="muted">{new Date(event.created_at * 1000).toLocaleString()}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No {paperEdition ? 'signet ' : ''}funding events yet.</p>
      {/if}
    </section>
  {/if}

  {#if status}
    <p class="wallet-status">{status}</p>
  {/if}
  {#if errorMessage}
    <p class="wallet-error">{errorMessage}</p>
  {/if}
</section>

<style>
  .wallet-page {
    display: grid;
    gap: 1.5rem;
    width: min(calc(100% - 2.5rem), 68rem);
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }

  .wallet-header {
    display: grid;
    gap: 0.75rem;
  }

  .wallet-header h1 {
    font-size: 2rem;
    letter-spacing: -0.04em;
  }

  .wallet-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .wallet-panel {
    display: grid;
    gap: 1rem;
    padding: 1rem 0;
    border-top: 1px solid var(--border-subtle);
  }

  .wallet-panel strong {
    font-size: 1.5rem;
    color: var(--text-strong);
    font-family: var(--font-mono);
  }

  .label,
  .field span {
    color: var(--text-faint);
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .muted {
    color: var(--text-muted);
  }

  .panel-header,
  .position-row,
  .history-row,
  .funding-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .field {
    display: grid;
    gap: 0.45rem;
    width: 100%;
    max-width: 16rem;
  }

  .field input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-subtle);
    background: var(--bg);
    color: var(--text-strong);
    padding: 0.85rem 0.95rem;
  }

  .position-list,
  .history-list {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--border-subtle);
  }

  .position-row,
  .history-row {
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--border-subtle);
    text-decoration: none;
    color: inherit;
  }

  .history-row-stack {
    align-items: flex-start;
  }

  .history-copy {
    display: grid;
    gap: 0.35rem;
  }

  .history-copy code {
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-faint);
  }

  .position-copy,
  .position-metrics {
    display: grid;
    gap: 0.35rem;
  }

  .position-metrics {
    justify-items: end;
    font-family: var(--font-mono);
  }

  .positive {
    color: var(--text-success);
  }

  .negative {
    color: var(--text-danger);
  }

  .wallet-status,
  .wallet-error {
    margin: 0;
    font-size: 0.95rem;
  }

  .wallet-status {
    color: var(--text-muted);
  }

  .wallet-error {
    color: var(--text-danger);
  }

  @media (max-width: 720px) {
    .wallet-grid {
      grid-template-columns: 1fr;
    }

    .panel-header,
    .position-row,
    .history-row,
    .funding-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .position-metrics {
      justify-items: start;
    }
  }
</style>
