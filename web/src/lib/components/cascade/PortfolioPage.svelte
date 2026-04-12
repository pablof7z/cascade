<script lang="ts">
  import { browser } from '$app/environment';
  import {
    createStripeTopup,
    createLightningTopupQuote,
    fetchMarketDetailBySlug,
    fetchPortfolioMirror,
    fetchProductRuntime,
    fetchWalletTopupRequestStatus,
    fetchWalletTopupStatus,
    parseJson,
    type ProductFundingEvent,
    type ProductMarketDetail,
    type ProductProof,
    type ProductRuntime,
    type ProductWallet,
    type ProductWalletTopup,
    type ProductWalletTopupRequestStatus
  } from '$lib/cascade/api';
  import { getProductApiUrl, isPaperEdition, isStripeTopupEnabled } from '$lib/cascade/config';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { quantityToShareMinor, shareMinorToQuantity } from '$lib/cascade/shares';
  import {
    attachPendingTopupId,
    clearPendingTopup,
    listPendingTopups,
    markPendingTopupNotified,
    trackPendingTopup
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';
  import { decodeLocalProofToken, encodeLocalProofWallet } from '$lib/wallet/cashuTokens';
  import {
    addLocalProofs,
    listLocalProofs,
    listLocalProofWallets,
    localProofBalance,
    type StoredProofWallet
  } from '$lib/wallet/localProofs';
  import { listLocalPositionBook } from '$lib/wallet/localPositionBook';

  type PaperWallet = ProductWallet & {
    funding_events: ProductFundingEvent[];
  };

  type LocalPortfolioPosition = {
    market_event_id: string;
    market_slug: string;
    market_title: string;
    direction: 'yes' | 'no';
    quantity: number;
    current_price_ppm: number;
    market_value_minor: number;
    cost_basis_minor: number | null;
    unrealized_pnl_minor: number | null;
  };

  const currentUser = $derived(ndk.$currentUser);
  const paperEdition = isPaperEdition();
  const stripeTopupEnabled = isStripeTopupEnabled();
  const editionLabel = paperEdition ? 'Signet' : 'Mainnet';
  const portfolioLabel = paperEdition ? 'signet portfolio' : 'portfolio';

  const proofUnit = 'usd';
  const signetTopupSingleLimitMinor = 10000;
  const signetTopupWindowLimitMinor = 25000;

  let wallet = $state<PaperWallet | null>(null);
  let runtime = $state<ProductRuntime | null>(null);
  let loading = $state(false);
  let errorMessage = $state('');
  let runtimeNotice = $state('');
  let status = $state('');
  let fundingAmount = $state(paperEdition ? '10000' : '2500');
  let localBalanceMinor = $state(0);
  let localProofCount = $state(0);
  let localProofWallets = $state<StoredProofWallet[]>([]);
  let localPositions = $state<LocalPortfolioPosition[]>([]);
  let localPositionValueMinor = $state(0);
  let selectedExportUnit = $state('');
  let exportedToken = $state('');
  let importToken = $state('');

  function proofMintUrl(): string {
    return getProductApiUrl().replace(/\/+$/, '');
  }

  function refreshLocalProofSummary() {
    const mintUrl = proofMintUrl();
    const wallets = listLocalProofWallets(mintUrl);
    localProofWallets = wallets;
    localBalanceMinor = localProofBalance(mintUrl, proofUnit);
    localProofCount = listLocalProofs(mintUrl, proofUnit).length;
    if (!selectedExportUnit || !wallets.some((walletEntry) => walletEntry.unit === selectedExportUnit)) {
      selectedExportUnit = wallets[0]?.unit ?? '';
    }
  }

  function formatProofBucketAmount(unit: string, amount: number): string {
    if (unit === proofUnit) {
      return formatUsdMinor(amount);
    }

    const parsed = parseMarketProofUnit(unit);
    if (parsed) {
      return `${parsed.direction.toUpperCase()} ${shareMinorToQuantity(amount).toFixed(2)} shares`;
    }

    return `${amount.toFixed(2)} ${unit}`;
  }

  function describeProofWallet(walletEntry: StoredProofWallet): string {
    const amount = walletEntry.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    if (walletEntry.unit === proofUnit) {
      return `USD cash · ${formatUsdMinor(amount)}`;
    }

    const parsed = parseMarketProofUnit(walletEntry.unit);
    if (parsed) {
      return `${parsed.direction.toUpperCase()} · ${parsed.slug} · ${shareMinorToQuantity(amount).toFixed(2)} shares`;
    }

    return `${walletEntry.unit} · ${amount.toFixed(2)}`;
  }

  function parseMarketProofUnit(unit: string): { slug: string; direction: 'yes' | 'no' } | null {
    if (/^long_/i.test(unit)) {
      return { slug: unit.slice('long_'.length), direction: 'yes' };
    }

    if (/^short_/i.test(unit)) {
      return { slug: unit.slice('short_'.length), direction: 'no' };
    }

    return null;
  }

  function describePositionPrice(position: LocalPortfolioPosition): string {
    if (position.current_price_ppm <= 0) {
      return 'Price unavailable';
    }

    return formatProbability(position.current_price_ppm / 1_000_000);
  }

  async function loadLocalPositionMarks() {
    const localBookByKey = new Map(
      listLocalPositionBook(proofMintUrl()).map((entry) => [`${entry.marketSlug}:${entry.side}`, entry])
    );
    const proofWallets = listLocalProofWallets(proofMintUrl());
    const marketWallets = proofWallets
      .filter((walletEntry) => walletEntry.unit !== proofUnit)
      .map((walletEntry) => {
        const parsed = parseMarketProofUnit(walletEntry.unit);
        if (!parsed) return null;

        const quantityMinor = walletEntry.proofs.reduce((sum, proof) => sum + proof.amount, 0);
        const quantity = shareMinorToQuantity(quantityMinor);
        if (quantity <= 0) return null;

        return {
          unit: walletEntry.unit,
          slug: parsed.slug,
          direction: parsed.direction,
          quantity
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (!marketWallets.length) {
      localPositions = [];
      localPositionValueMinor = 0;
      return;
    }

    const positions: Array<LocalPortfolioPosition | null> = await Promise.all(
      marketWallets.map(async (entry) => {
        const localBookEntry = localBookByKey.get(`${entry.slug}:${entry.direction}`) ?? null;
        const localCostBasisMinor =
          localBookEntry && localBookEntry.quantityMinor === quantityToShareMinor(entry.quantity)
            ? localBookEntry.costBasisMinor
            : null;

        try {
          const response = await fetchMarketDetailBySlug(entry.slug);
          if (!response.ok) {
            throw new Error('market_detail_unavailable');
          }

          const payload = await parseJson<ProductMarketDetail>(
            response,
            'Failed to load current market pricing.'
          );
          const currentPricePpm =
            entry.direction === 'yes'
              ? payload.market.price_yes_ppm
              : payload.market.price_no_ppm;
          const marketValueMinor = Math.floor((entry.quantity * currentPricePpm) / 1_000_000);

          return {
            market_event_id: payload.market.event_id,
            market_slug: payload.market.slug,
            market_title: payload.market.title,
            direction: entry.direction,
            quantity: entry.quantity,
            current_price_ppm: currentPricePpm,
            market_value_minor: marketValueMinor,
            cost_basis_minor: localCostBasisMinor,
            unrealized_pnl_minor:
              localCostBasisMinor === null ? null : marketValueMinor - localCostBasisMinor
          } satisfies LocalPortfolioPosition;
        } catch {
          return {
            market_event_id: localBookEntry?.marketEventId ?? '',
            market_slug: entry.slug,
            market_title: localBookEntry?.marketTitle ?? entry.slug,
            direction: entry.direction,
            quantity: entry.quantity,
            current_price_ppm: 0,
            market_value_minor: 0,
            cost_basis_minor: localCostBasisMinor,
            unrealized_pnl_minor: null
          } satisfies LocalPortfolioPosition;
        }
      })
    );

    const nextPositions = positions.filter(
      (position): position is LocalPortfolioPosition => position !== null
    );

    localPositions = nextPositions.sort(
      (left, right) => right.market_value_minor - left.market_value_minor
    );
    localPositionValueMinor = localPositions.reduce(
      (sum, position) => sum + position.market_value_minor,
      0
    );
  }

  const selectedExportWallet = $derived(
    localProofWallets.find((walletEntry) => walletEntry.unit === selectedExportUnit) ?? null
  );
  const usingLocalPositionMarks = $derived(localPositions.length > 0);
  const displayedPositionValueMinor = $derived(localPositionValueMinor);
  const displayedTotalValueMinor = $derived(localBalanceMinor + displayedPositionValueMinor);
  const expectedEdition = paperEdition ? 'signet' : 'mainnet';
  const runtimeEditionMismatch = $derived(
    runtime !== null && runtime.edition !== expectedEdition
  );
  const lightningTopupAvailable = $derived(
    runtime !== null && !runtimeEditionMismatch && runtime.funding.lightning.available
  );
  const stripeTopupAvailable = $derived(
    stripeTopupEnabled &&
      runtime !== null &&
      !runtimeEditionMismatch &&
      runtime.funding.stripe.available
  );

  function runtimeMismatchMessage(actualEdition: string): string {
    return `This ${portfolioLabel} is pointed at a ${actualEdition} mint. Funding and trading stay disabled until the API target is corrected.`;
  }

  function railUnavailableMessage(rail: 'lightning' | 'stripe'): string {
    if (!runtime) {
      return 'Funding is unavailable until the portfolio can verify the mint runtime.';
    }

    if (runtimeEditionMismatch) {
      return runtimeMismatchMessage(runtime.edition);
    }

    const configuredReason =
      rail === 'stripe' ? runtime.funding.stripe.reason : runtime.funding.lightning.reason;
    if (configuredReason === 'stripe_topups_unavailable') {
      return 'Stripe top-ups are not configured for this edition yet.';
    }
    if (configuredReason === 'lightning_topups_unavailable') {
      return 'Lightning top-ups are not configured for this edition yet.';
    }

    return rail === 'stripe'
      ? 'Stripe top-ups are unavailable for this edition right now.'
      : 'Lightning top-ups are unavailable for this edition right now.';
  }

  async function loadRuntime() {
    runtimeNotice = '';

    try {
      const response = await fetchProductRuntime();
      const nextRuntime = await parseJson<ProductRuntime>(response, 'Failed to load portfolio runtime.');
      runtime = nextRuntime;
      if (nextRuntime.edition !== expectedEdition) {
        runtimeNotice = runtimeMismatchMessage(nextRuntime.edition);
      }
    } catch (error) {
      runtime = null;
      runtimeNotice =
        error instanceof Error
          ? error.message
          : 'Failed to load the portfolio runtime manifest.';
    }
  }

  async function loadWallet() {
    if (!currentUser) return;
    loading = true;
    errorMessage = '';
    try {
      if (!runtime || runtimeEditionMismatch) {
        wallet = null;
        return;
      }
      const response = await fetchPortfolioMirror(currentUser.pubkey);
      wallet = await parseJson<PaperWallet>(response, 'Failed to load portfolio funding activity.');
    } catch (error) {
      wallet = null;
      errorMessage =
        error instanceof Error ? error.message : 'Failed to load portfolio funding activity.';
    } finally {
      await loadLocalPositionMarks();
      loading = false;
    }
  }

  function applyIssuedProofs(proofs: ProductProof[] | null | undefined, sourceLabel: string): boolean {
    if (!proofs?.length) return false;
    const snapshot = addLocalProofs(proofMintUrl(), proofUnit, proofs);
    localBalanceMinor = snapshot.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    localProofCount = snapshot.proofs.length;
    void loadLocalPositionMarks();
    status = `${sourceLabel} added ${formatUsdMinor(proofs.reduce((sum, proof) => sum + proof.amount, 0))} of browser-local proofs.`;
    return true;
  }

  async function prepareExportToken() {
    errorMessage = '';

    if (!selectedExportWallet) {
      exportedToken = '';
      errorMessage = 'No local proof bucket is available to export.';
      return;
    }

    exportedToken = encodeLocalProofWallet(selectedExportWallet);
    const amount = selectedExportWallet.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    status = `Prepared ${formatProofBucketAmount(selectedExportWallet.unit, amount)} as a Cashu token string.`;
  }

  async function copyExportToken() {
    if (!browser || !exportedToken) {
      errorMessage = 'Prepare a token before copying it.';
      return;
    }

    if (!navigator.clipboard?.writeText) {
      errorMessage = 'Clipboard access is not available in this browser.';
      return;
    }

    await navigator.clipboard.writeText(exportedToken);
    status = 'Copied the exported token to your clipboard.';
  }

  async function importPortfolioToken() {
    errorMessage = '';

    if (!importToken.trim()) {
      errorMessage = 'Paste a Cashu token before importing it.';
      return;
    }

    try {
      const decoded = decodeLocalProofToken(importToken, proofMintUrl());
      addLocalProofs(decoded.mintUrl, decoded.unit, decoded.proofs);
      refreshLocalProofSummary();
      await loadLocalPositionMarks();
      importToken = '';
      status = `Imported ${formatProofBucketAmount(decoded.unit, decoded.amount)} into this browser.`;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Failed to import the pasted Cashu token.';
    }
  }

  function formatSignetTopupError(message: string): string {
    if (message.startsWith('signet_topup_single_limit_exceeded')) {
      return `Signet funding is capped at ${formatUsdMinor(signetTopupSingleLimitMinor)} per top-up.`;
    }

    if (message.startsWith('signet_topup_window_limit_exceeded')) {
      return `Signet funding is capped at ${formatUsdMinor(signetTopupWindowLimitMinor)} per 24 hours.`;
    }

    return message;
  }

  function formatStripeTopupError(message: string): string {
    if (message.startsWith('stripe_topup_single_limit_exceeded')) {
      const maxMinor = Number.parseInt(message.split('max_minor=')[1] ?? '', 10);
      if (Number.isFinite(maxMinor) && maxMinor > 0) {
        return `Card top-ups are capped at ${formatUsdMinor(maxMinor)} per top-up right now.`;
      }
      return 'Card top-ups are capped per top-up right now.';
    }

    if (message.startsWith('stripe_topup_window_limit_exceeded')) {
      const windowMinor = Number.parseInt(message.split('window_minor=')[1]?.split(':')[0] ?? '', 10);
      if (Number.isFinite(windowMinor) && windowMinor > 0) {
        return `Card top-ups are capped at ${formatUsdMinor(windowMinor)} per 24 hours right now.`;
      }
      return 'Card top-ups are capped per 24 hours right now.';
    }

    return message;
  }

  function topupLabel(rail: string): string {
    return rail === 'stripe' ? 'Stripe top-up' : 'Lightning top-up';
  }

  function isPendingTopupStatus(status: string): boolean {
    return status === 'invoice_pending' || status === 'pending';
  }

  async function createLightningTopup() {
    if (!currentUser) {
      errorMessage = `Sign in before starting a top-up for your ${portfolioLabel}.`;
      return;
    }

    if (!lightningTopupAvailable) {
      errorMessage = railUnavailableMessage('lightning');
      return;
    }

    const amountMinor = Number.parseInt(fundingAmount, 10) || 0;
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
      if (topup.status === 'complete') {
        clearPendingTopup(requestId);
      }
      await loadWallet();
      if (topup.status === 'complete') {
        if (!applyIssuedProofs(topup.issued_proofs, 'Lightning top-up')) {
          status = `Completed the Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
        }
      } else {
        status = `Created a Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lightning top-up creation failed.';
      if (message === 'wallet_topup_request_in_progress') {
        status = `Recovering the Lightning top-up for ${formatUsdMinor(amountMinor)}.`;
      } else {
        clearPendingTopup(requestId);
        errorMessage = formatSignetTopupError(message);
        status = '';
      }
    }
  }

  async function createStripeCheckout() {
    if (!currentUser) {
      errorMessage = `Sign in before starting a top-up for your ${portfolioLabel}.`;
      return;
    }

    if (!stripeTopupAvailable) {
      errorMessage = railUnavailableMessage('stripe');
      return;
    }

    const amountMinor = Number.parseInt(fundingAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a Stripe top-up amount greater than zero.';
      return;
    }

    status = `Creating a Stripe top-up for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';
    const requestId = crypto.randomUUID();
    trackPendingTopup({
      id: requestId,
      requestId,
      pubkey: currentUser.pubkey,
      amountMinor,
      rail: 'stripe'
    });

    try {
      const response = await createStripeTopup({
        pubkey: currentUser.pubkey,
        amountMinor,
        requestId
      });
      const topup = await parseJson<ProductWalletTopup>(response, 'Stripe top-up creation failed.');

      attachPendingTopupId(requestId, topup.id);
      await loadWallet();

      if (topup.status === 'complete') {
        clearPendingTopup(requestId);
        if (!applyIssuedProofs(topup.issued_proofs, 'Stripe top-up')) {
          status = `Completed the Stripe top-up for ${formatUsdMinor(amountMinor)}.`;
        }
        return;
      }

      status = `Created a Stripe top-up for ${formatUsdMinor(amountMinor)}.`;
      if (browser && topup.checkout_url) {
        window.location.assign(topup.checkout_url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe top-up creation failed.';
      if (message === 'wallet_topup_request_in_progress') {
        status = `Recovering the Stripe top-up for ${formatUsdMinor(amountMinor)}.`;
      } else if (message === 'stripe_topups_unavailable') {
        clearPendingTopup(requestId);
        errorMessage = 'Stripe top-ups are not configured for this edition yet.';
        status = '';
      } else {
        clearPendingTopup(requestId);
        errorMessage = formatStripeTopupError(message);
        status = '';
      }
    }
  }

  async function refreshPendingTopups() {
    if (!runtime || runtimeEditionMismatch) {
      errorMessage = railUnavailableMessage('lightning');
      return;
    }

    status = 'Refreshing pending top-ups.';
    errorMessage = '';
    await loadWallet();
    await reconcilePendingTopups();
  }

  async function reconcilePendingTopups() {
    if (!currentUser || !runtime || runtimeEditionMismatch) return;

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
            `Failed to recover the ${topupLabel(trackedTopup.rail).toLowerCase()} status.`
          );

          if (requestStatus.status === 'pending') {
            if (!trackedTopup.pendingNotified) {
              status = `Recovered pending ${topupLabel(trackedTopup.rail).toLowerCase()} for ${formatUsdMinor(trackedTopup.amountMinor)}.`;
              markPendingTopupNotified(trackedTopup.id);
            }
            continue;
          }

          if (requestStatus.status === 'failed') {
            clearPendingTopup(trackedTopup.id);
            errorMessage =
              requestStatus.error || `${topupLabel(trackedTopup.rail)} creation failed.`;
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
            `Failed to recover the ${topupLabel(trackedTopup.rail).toLowerCase()} status.`
          );
        }

        if (isPendingTopupStatus(topup.status)) {
          if (!trackedTopup.pendingNotified) {
            status = `Recovered pending ${topupLabel(topup.rail).toLowerCase()} for ${formatUsdMinor(topup.amount_minor)}.`;
            markPendingTopupNotified(trackedTopup.id);
          }
          continue;
        }

        clearPendingTopup(trackedTopup.id);
        walletNeedsRefresh = true;

        if (topup.status === 'complete') {
          applyIssuedProofs(topup.issued_proofs, `Recovered ${topupLabel(topup.rail)}`);
        } else {
          status =
            topup.status === 'review_required'
              ? `Recovered ${topupLabel(topup.rail).toLowerCase()} under review for ${formatUsdMinor(topup.amount_minor)}. No proofs were issued.`
              : `Recovered ${topup.status.replace(/_/g, ' ')} ${topupLabel(topup.rail).toLowerCase()} for ${formatUsdMinor(topup.amount_minor)}.`;
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
    void loadRuntime();
  });

  $effect(() => {
    if (!browser || !currentUser || !runtime) return;
    void (async () => {
      refreshLocalProofSummary();
      await loadWallet();
      await reconcilePendingTopups();
    })();
  });

  $effect(() => {
    if (!browser || !currentUser || !runtime || runtimeEditionMismatch) return;

    const interval = window.setInterval(() => {
      void reconcilePendingTopups();
    }, 1000);

    return () => window.clearInterval(interval);
  });
</script>

<section class="wallet-page">
  <header class="wallet-header">
    <div class="eyebrow">{editionLabel} Portfolio</div>
    <h1>Browser-local proof portfolio</h1>
    <p>
      Portfolio proofs are stored in this browser in both signet and mainnet. Liquid cash comes
      from local USD proofs. Current position value is marked from public market prices, and exact
      exits still come from fresh withdrawal quotes.
    </p>
    {#if runtimeNotice}
      <p class="muted">{runtimeNotice}</p>
    {/if}
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
        <span class="label">Position Mark</span>
        <strong>{formatUsdMinor(displayedPositionValueMinor)}</strong>
        <p class="muted">
          {#if usingLocalPositionMarks}
            Derived from local market-proof holdings, the browser-local trade book, and current public market prices.
          {:else}
            No local market proofs found in this browser yet.
          {/if}
        </p>
      </article>

      <article class="wallet-panel">
        <span class="label">Current Value</span>
        <strong>{formatUsdMinor(displayedTotalValueMinor)}</strong>
        <p class="muted">
          Cash plus current position marks. Exact withdrawal proceeds can differ because LMSR pricing is size-dependent.
        </p>
      </article>
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Add funds</h2>
          <p class="muted">
            Fund browser-local USD proofs with Stripe or Lightning.
            {#if paperEdition}
              In signet, funding still follows the normal pending-topup lifecycle. Limit {formatUsdMinor(signetTopupSingleLimitMinor)}
              per top-up and {formatUsdMinor(signetTopupWindowLimitMinor)} per 24 hours.
            {/if}
          </p>
          {#if !runtimeNotice && runtime && !runtime.funding.lightning.available}
            <p class="muted">{railUnavailableMessage('lightning')}</p>
          {:else if stripeTopupEnabled && runtime && !runtime.funding.stripe.available}
            <p class="muted">{railUnavailableMessage('stripe')}</p>
          {/if}
        </div>
      </div>

      <div class="funding-row">
        <label class="field">
          <span>Funding amount</span>
          <input
            aria-label="Funding amount"
            bind:value={fundingAmount}
            min="100"
            step="100"
            type="number"
          />
        </label>
        {#if stripeTopupEnabled}
          <button
            class="button-primary"
            disabled={!stripeTopupAvailable}
            onclick={createStripeCheckout}
            type="button"
          >
            Checkout with card
          </button>
        {/if}
        <button
          class="button-secondary"
          disabled={!lightningTopupAvailable}
          onclick={createLightningTopup}
          type="button"
        >
          Create Lightning invoice
        </button>
      </div>

      {#if wallet?.pending_topups?.length}
        <div class="history-list">
          {#each wallet.pending_topups as topup (topup.id)}
            <div class="history-row history-row-stack">
              <div class="history-copy">
                <strong>{formatUsdMinor(topup.amount_minor)}</strong>
                <p class="muted">
                  {topup.rail} · {topup.status}
                  {#if topup.fx_source}
                    · fx {topup.fx_source}
                  {/if}
                </p>
                {#if topup.invoice}
                  <code>{topup.invoice}</code>
                {/if}
                {#if topup.checkout_session_id}
                  <p class="muted">Checkout session {topup.checkout_session_id}</p>
                {/if}
              </div>
              <div class="proof-transfer-actions">
                {#if topup.checkout_url}
                  <a class="button-secondary" href={topup.checkout_url}>Open checkout</a>
                {/if}
                <button class="button-secondary" onclick={refreshPendingTopups} type="button">
                  Refresh status
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No pending top-ups.</p>
      {/if}
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Move proofs</h2>
          <p class="muted">
            Export or import Cashu token strings locally in this browser. These are bearer proofs.
          </p>
        </div>
      </div>

      <div class="proof-transfer-grid">
        <div class="proof-transfer-column">
          <label class="field">
            <span>Export bucket</span>
            <select aria-label="Export token bucket" bind:value={selectedExportUnit}>
              {#if localProofWallets.length}
                {#each localProofWallets as walletEntry (walletEntry.unit)}
                  <option value={walletEntry.unit}>{describeProofWallet(walletEntry)}</option>
                {/each}
              {:else}
                <option value="">No local proofs yet</option>
              {/if}
            </select>
          </label>

          <div class="proof-transfer-actions">
            <button class="button-primary" disabled={!localProofWallets.length} onclick={prepareExportToken} type="button">
              Prepare token
            </button>
            <button class="button-secondary" disabled={!exportedToken} onclick={copyExportToken} type="button">
              Copy token
            </button>
          </div>

          <label class="field">
            <span>Exported token</span>
            <textarea
              aria-label="Exported token"
              bind:value={exportedToken}
              placeholder="Prepare a Cashu token string from a local proof bucket."
              readonly
              rows="5"
            ></textarea>
          </label>
        </div>

        <div class="proof-transfer-column">
          <label class="field field-wide">
            <span>Import token</span>
            <textarea
              aria-label="Import token"
              bind:value={importToken}
              placeholder="Paste a Cashu token string for this edition's mint."
              rows="5"
            ></textarea>
          </label>

          <button class="button-primary proof-transfer-submit" onclick={importPortfolioToken} type="button">
            Import token
          </button>
        </div>
      </div>
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Open positions</h2>
          <p class="muted">
            {#if usingLocalPositionMarks}
              Position quantity comes from local proofs. Cost basis comes from trades executed in this browser. Current USD value uses public market prices.
            {:else}
              No local market proofs found in this browser yet.
            {/if}
          </p>
        </div>
        <a class="button-secondary" href="/builder">Create market</a>
      </div>

      {#if localPositions.length}
        <div class="position-list">
          {#each localPositions as position (position.market_slug + position.direction)}
            <a class="position-row" href={`/market/${position.market_slug}`}>
              <div class="position-copy">
                <strong>{position.market_title}</strong>
                <p>{position.direction === 'yes' ? 'LONG' : 'SHORT'} · {position.quantity.toFixed(2)} shares · {describePositionPrice(position)}</p>
              </div>
              <div class="position-metrics">
                <span>{formatUsdMinor(position.market_value_minor)}</span>
                {#if position.unrealized_pnl_minor === null || position.unrealized_pnl_minor === undefined}
                  <span class="muted">Mark only</span>
                {:else}
                  <span class:positive={position.unrealized_pnl_minor >= 0} class:negative={position.unrealized_pnl_minor < 0}>
                    {position.unrealized_pnl_minor >= 0 ? '+' : ''}{formatUsdMinor(Math.abs(position.unrealized_pnl_minor))}
                  </span>
                {/if}
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
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
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

  .field select,
  .field textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-subtle);
    background: var(--bg);
    color: var(--text-strong);
    padding: 0.85rem 0.95rem;
  }

  .field textarea {
    resize: vertical;
    min-height: 7rem;
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }

  .field-wide {
    max-width: none;
  }

  .proof-transfer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
  }

  .proof-transfer-column,
  .proof-transfer-actions {
    display: grid;
    gap: 0.75rem;
  }

  .proof-transfer-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .proof-transfer-submit {
    width: fit-content;
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

    .proof-transfer-actions {
      grid-template-columns: 1fr;
    }

    .position-metrics {
      justify-items: start;
    }
  }
</style>
