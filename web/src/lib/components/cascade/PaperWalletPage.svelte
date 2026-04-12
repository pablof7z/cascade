<script lang="ts">
  import { browser } from '$app/environment';
  import {
    createLightningTopupQuote,
    fetchPaperWallet,
    fetchWalletTopupStatus,
    parseJson,
    settleLightningTopupQuote,
    type ProductWallet,
    type ProductWalletTopup,
    type ProductWalletTopupExecution
  } from '$lib/cascade/api';
  import { getProductApiUrl } from '$lib/cascade/config';
  import { formatUsdMinor } from '$lib/cascade/format';
  import {
    clearPendingTopup,
    listPendingTopups,
    markPendingTopupNotified,
    trackPendingTopup
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';

  type FundingEvent = {
    id: string;
    rail: string;
    amount_minor: number;
    status: string;
    risk_level?: string | null;
    created_at: number;
  };

  type PaperWallet = ProductWallet & {
    funding_events: FundingEvent[];
  };

  const currentUser = $derived(ndk.$currentUser);

  let wallet = $state<PaperWallet | null>(null);
  let loading = $state(false);
  let errorMessage = $state('');
  let status = $state('');
  let faucetAmount = $state('10000');
  let lightningAmount = $state('2500');

  async function loadWallet() {
    if (!currentUser) return;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetchPaperWallet(currentUser.pubkey);
      wallet = await parseJson<PaperWallet>(response, 'Failed to load your paper wallet.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load your paper wallet.';
    } finally {
      loading = false;
    }
  }

  async function addPaperFunds() {
    if (!currentUser) {
      errorMessage = 'Sign in before funding your paper wallet.';
      return;
    }

    const amountMinor = Number.parseInt(faucetAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a paper funding amount greater than zero.';
      return;
    }

    status = `Adding ${formatUsdMinor(amountMinor)} to your paper wallet.`;
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
      errorMessage = payload?.error || 'Paper funding failed.';
      status = '';
      return;
    }

    wallet = (await response.json()) as PaperWallet;
    status = `Added ${formatUsdMinor(amountMinor)} to your paper wallet.`;
  }

  async function createLightningTopup() {
    if (!currentUser) {
      errorMessage = 'Sign in before starting a Lightning top-up.';
      return;
    }

    const amountMinor = Number.parseInt(lightningAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a Lightning top-up amount greater than zero.';
      return;
    }

    status = `Creating a Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';
    try {
      const response = await createLightningTopupQuote({
        pubkey: currentUser.pubkey,
        amountMinor
      });
      const topup = await parseJson<ProductWalletTopup>(response, 'Lightning top-up creation failed.');

      trackPendingTopup({
        id: topup.id,
        pubkey: currentUser.pubkey,
        amountMinor: topup.amount_minor,
        rail: 'lightning'
      });
      await loadWallet();
      status = `Created a Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Lightning top-up creation failed.';
      status = '';
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
      wallet = payload.wallet;
      clearPendingTopup(topupId);
      status = `Completed the signet Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Lightning top-up settlement failed.';
      status = '';
    }
  }

  async function reconcilePendingTopups() {
    if (!currentUser) return;

    const trackedTopups = listPendingTopups(currentUser.pubkey);
    if (!trackedTopups.length) return;

    let walletNeedsRefresh = false;

    for (const trackedTopup of trackedTopups) {
      try {
        const response = await fetchWalletTopupStatus(trackedTopup.id);
        const topup = await parseJson<ProductWalletTopup>(
          response,
          'Failed to recover the Lightning top-up status.'
        );

        if (topup.status === 'invoice_pending') {
          if (!trackedTopup.pendingNotified) {
            status = `Recovered pending Lightning top-up for ${formatUsdMinor(topup.amount_minor)}.`;
            markPendingTopupNotified(topup.id);
          }
          continue;
        }

        clearPendingTopup(topup.id);
        walletNeedsRefresh = true;

        if (topup.status === 'complete') {
          status = `Recovered completed Lightning top-up for ${formatUsdMinor(topup.amount_minor)}.`;
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
    if (!browser || !currentUser) return;
    void (async () => {
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
</script>

<section class="wallet-page">
  <header class="wallet-header">
    <div class="eyebrow">Paper Wallet</div>
    <h1>Paper wallet</h1>
    <p>Signet mode uses a paper wallet backed by the mint API. Funding here is for testing the full market flow.</p>
  </header>

  {#if !currentUser}
    <section class="wallet-panel">
      <h2>Sign in to use the paper wallet</h2>
      <p class="muted">Your paper balance and positions are keyed to your current signing identity.</p>
    </section>
  {:else}
    <section class="wallet-grid">
      <article class="wallet-panel">
        <span class="label">Available</span>
        <strong>{formatUsdMinor(wallet?.available_minor ?? 0)}</strong>
        <p class="muted">Pending: {formatUsdMinor(wallet?.pending_minor ?? 0)}</p>
      </article>

      <article class="wallet-panel">
        <span class="label">Deposited</span>
        <strong>{formatUsdMinor(wallet?.total_deposited_minor ?? 0)}</strong>
        <p class="muted">Use this balance to seed and trade public markets.</p>
      </article>
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Add paper funds</h2>
          <p class="muted">This faucet exists only for signet testing.</p>
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

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Lightning top-up</h2>
          <p class="muted">Create a Lightning invoice. Pay it externally or complete it locally for signet testing.</p>
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
              <button
                class="button-secondary"
                onclick={() => settleLightningTopup(topup.id, topup.amount_minor)}
                type="button"
              >
                Complete locally for signet
              </button>
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
          <p class="muted">Current market value and unrealized PnL update from the mint.</p>
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
        <p class="muted">Loading wallet state.</p>
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
        <p class="muted">No paper funding events yet.</p>
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
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .position-copy,
  .position-metrics,
  .history-copy {
    display: grid;
    gap: 0.25rem;
  }

  .position-metrics {
    text-align: right;
    font-family: var(--font-mono);
  }

  .positive {
    color: var(--positive);
  }

  .negative,
  .wallet-error {
    color: var(--negative);
  }

  .wallet-status {
    color: var(--text-muted);
  }

  .history-row-stack {
    align-items: flex-start;
  }

  code {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: var(--font-mono);
  }

  @media (max-width: 900px) {
    .wallet-grid,
    .panel-header,
    .position-row,
    .history-row,
    .funding-row {
      grid-template-columns: 1fr;
      flex-direction: column;
      align-items: flex-start;
    }

    .position-metrics {
      text-align: left;
    }
  }
</style>
