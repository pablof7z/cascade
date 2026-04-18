<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import CopyButton from '$lib/components/wallet/CopyButton.svelte';
  import QRCode from '$lib/components/wallet/QRCode.svelte';
  import {
    createStripeFunding,
    fetchPortfolioFundingRequestStatus,
    fetchPortfolioFundingStatus,
    parseJson,
    type ProductProof,
    type ProductPortfolioFunding,
    type ProductPortfolioFundingRequestStatus
  } from '$lib/cascade/api';
  import {
    getCascadeClientRuntime,
    getCascadeEdition,
    getProductApiUrl,
    isPaperEdition,
    isStripeFundingEnabled
  } from '$lib/cascade/config';
  import { formatDateTime, formatUsdMinor } from '$lib/cascade/format';
  import { quantityToShareMinor, shareMinorToQuantity } from '$lib/cascade/shares';
  import {
    patchPendingFunding,
    attachPendingFundingMintPreparation,
    clearPendingFunding,
    listPendingFundings,
    listFundingHistory,
    markPendingFundingNotified,
    recordFundingHistory,
    trackPendingFunding,
    type PendingFundingRecord
  } from '$lib/cascade/recovery';
  import type { LocalFundingHistoryRecord } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';
  import { fetchPublicMarketSnapshotBySlug } from '$lib/ndk/publicMarkets';
  import {
    checkUsdLightningMintQuote,
    createUsdLightningMintQuote,
    mintUsdLightningQuote,
    prepareUsdLightningMint,
    restoreUsdLightningQuote
  } from '$lib/wallet/cashuMint';
  import {
    addLocalProofs,
    listLocalProofWallets,
    localProofBalance
  } from '$lib/wallet/localProofs';
  import { listLocalPositionBook } from '$lib/wallet/localPositionBook';

  type LocalPendingFunding = {
    id: string;
    rail: 'lightning' | 'stripe';
    amount_minor: number;
    status: string;
    invoice?: string;
    checkout_url?: string;
    checkout_session_id?: string;
  };

  type LocalPortfolioPosition = {
    market_event_id: string;
    market_slug: string;
    market_title: string;
    direction: 'long' | 'short';
    quantity: number;
    current_price_ppm: number;
    market_value_minor: number;
    cost_basis_minor: number | null;
    unrealized_pnl_minor: number | null;
  };

  const currentUser = $derived(ndk.$currentUser);
  const selectedEdition = $derived(getCascadeEdition(page.data.cascadeEdition ?? null));
  const paperEdition = $derived(isPaperEdition(selectedEdition));
  const stripeFundingEnabled = $derived(isStripeFundingEnabled(selectedEdition));
  const portfolioLabel = $derived(paperEdition ? 'practice portfolio' : 'portfolio');

  const proofUnit = 'usd';
  const signetFundingSingleLimitMinor = 10000;
  const signetFundingWindowLimitMinor = 25000;
  const runtime = $derived(getCascadeClientRuntime(selectedEdition));

  let loading = $state(false);
  let errorMessage = $state('');
  let status = $state('');
  let fundingAmount = $state(isPaperEdition(page.data.cascadeEdition ?? null) ? '10000' : '2500');
  let localBalanceMinor = $state(0);
  let localPositions = $state<LocalPortfolioPosition[]>([]);
  let localPositionValueMinor = $state(0);
  let pendingFundings = $state<LocalPendingFunding[]>([]);
  let fundingHistory = $state<LocalFundingHistoryRecord[]>([]);

  function proofMintUrl(): string {
    return getProductApiUrl(selectedEdition).replace(/\/+$/, '');
  }

  function refreshLocalProofSummary() {
    const mintUrl = proofMintUrl();
    localBalanceMinor = localProofBalance(mintUrl, proofUnit);
  }

  function refreshLocalFundingState() {
    if (!currentUser) {
      pendingFundings = [];
      fundingHistory = [];
      return;
    }

    pendingFundings = listPendingFundings(currentUser.pubkey).map((entry) => ({
      id: entry.fundingId ?? entry.id,
      rail: entry.rail,
      amount_minor: entry.amountMinor,
      status: entry.status ?? 'invoice_pending',
      invoice: entry.invoice,
      checkout_url: entry.checkoutUrl,
      checkout_session_id: entry.checkoutSessionId
    }));
    fundingHistory = listFundingHistory(currentUser.pubkey);
  }

  function parseMarketProofUnit(unit: string): { slug: string; direction: 'long' | 'short' } | null {
    if (/^long_/i.test(unit)) {
      return { slug: unit.slice('long_'.length), direction: 'long' };
    }

    if (/^short_/i.test(unit)) {
      return { slug: unit.slice('short_'.length), direction: 'short' };
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
          const payload = await fetchPublicMarketSnapshotBySlug(entry.slug, selectedEdition);
          if (!payload) throw new Error('market_detail_unavailable');

          const yesPricePpm = payload.yesPricePpm;
          const currentPricePpm =
            entry.direction === 'long'
              ? yesPricePpm
              : 1_000_000 - yesPricePpm;
          const marketValueMinor = Math.floor((entry.quantity * currentPricePpm) / 1_000_000);

          return {
            market_event_id: payload.market.id,
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

  const usingLocalPositionMarks = $derived(localPositions.length > 0);
  const displayedPositionValueMinor = $derived(localPositionValueMinor);
  const displayedTotalValueMinor = $derived(localBalanceMinor + displayedPositionValueMinor);
  const lightningFundingAvailable = $derived(runtime.funding.lightning.available);
  const stripeFundingAvailable = $derived(
    stripeFundingEnabled && runtime.funding.stripe.available
  );

  function railUnavailableMessage(rail: 'lightning' | 'stripe'): string {
    const configuredReason =
      rail === 'stripe' ? runtime.funding.stripe.reason : runtime.funding.lightning.reason;
    if (configuredReason === 'stripe_fundings_unavailable') {
      return 'Card funding is not available right now.';
    }
    if (configuredReason === 'lightning_fundings_unavailable') {
      return 'Lightning funding is not available right now.';
    }

    return rail === 'stripe'
      ? 'Card funding is unavailable right now.'
      : 'Lightning funding is unavailable right now.';
  }

  async function refreshPortfolioView() {
    loading = true;
    try {
      refreshLocalProofSummary();
      refreshLocalFundingState();
      await loadLocalPositionMarks();
    } finally {
      loading = false;
    }
  }

  function applyIssuedProofs(proofs: ProductProof[] | null | undefined, sourceLabel: string): boolean {
    if (!proofs?.length) return false;
    const snapshot = addLocalProofs(proofMintUrl(), proofUnit, proofs);
    localBalanceMinor = snapshot.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    void loadLocalPositionMarks();
    status = `${sourceLabel} added ${formatUsdMinor(proofs.reduce((sum, proof) => sum + proof.amount, 0))} to this portfolio.`;
    return true;
  }

  function formatSignetFundingError(message: string): string {
    if (message.startsWith('signet_funding_single_limit_exceeded')) {
      return `Practice mode funding is capped at ${formatUsdMinor(signetFundingSingleLimitMinor)} per funding request.`;
    }

    if (message.startsWith('signet_funding_window_limit_exceeded')) {
      return `Practice mode funding is capped at ${formatUsdMinor(signetFundingWindowLimitMinor)} per 24 hours.`;
    }

    return message;
  }

  function formatStripeFundingError(message: string): string {
    if (message.startsWith('stripe_funding_single_limit_exceeded')) {
      const maxMinor = Number.parseInt(message.split('max_minor=')[1] ?? '', 10);
      if (Number.isFinite(maxMinor) && maxMinor > 0) {
        return `Card funding is capped at ${formatUsdMinor(maxMinor)} per funding request right now.`;
      }
      return 'Card funding is capped per funding request right now.';
    }

    if (message.startsWith('stripe_funding_window_limit_exceeded')) {
      const windowMinor = Number.parseInt(message.split('window_minor=')[1]?.split(':')[0] ?? '', 10);
      if (Number.isFinite(windowMinor) && windowMinor > 0) {
        return `Card funding is capped at ${formatUsdMinor(windowMinor)} per 24 hours right now.`;
      }
      return 'Card funding is capped per 24 hours right now.';
    }

    return message;
  }

  function fundingLabel(rail: string): string {
    return rail === 'stripe' ? 'card payment' : 'Lightning payment';
  }

  function fundingRailLabel(rail: string): string {
    return rail === 'stripe' ? 'Card' : 'Lightning';
  }

  function fundingStatusLabel(status: string, rail: string): string {
    switch (status) {
      case 'invoice_pending':
        return 'Waiting for payment';
      case 'pending':
        return rail === 'stripe' ? 'Checkout open' : 'Waiting for payment';
      case 'paid':
        return 'Payment received';
      case 'complete':
        return 'Funds added';
      case 'review_required':
        return 'Under review';
      case 'failed':
        return 'Failed';
      default:
        return status.replace(/_/g, ' ');
    }
  }

  async function recoverLightningQuote(trackedFunding: PendingFundingRecord) {
    if (!trackedFunding.requestId) {
      return null;
    }

    try {
      const quote = await createUsdLightningMintQuote(proofMintUrl(), trackedFunding.amountMinor, {
        description: `Cascade portfolio funding for ${trackedFunding.pubkey}`,
        pubkey: trackedFunding.pubkey,
        requestId: trackedFunding.requestId
      });
      return quote;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lightning funding recovery failed.';
      if (message === 'wallet_funding_request_in_progress') {
        if (!trackedFunding.pendingNotified) {
          status = `${fundingRailLabel(trackedFunding.rail)} payment still pending for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
          markPendingFundingNotified(trackedFunding.id);
        }
        return null;
      }

      throw error;
    }
  }

  function isPendingFundingStatus(status: string): boolean {
    return status === 'invoice_pending' || status === 'pending';
  }

  async function createLightningFunding() {
    if (!currentUser) {
      errorMessage = `Sign in before starting funding for your ${portfolioLabel}.`;
      return;
    }

    if (!lightningFundingAvailable) {
      errorMessage = railUnavailableMessage('lightning');
      return;
    }

    const amountMinor = Number.parseInt(fundingAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a Lightning amount greater than zero.';
      return;
    }

    status = `Preparing a Lightning payment for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';
    const requestId = crypto.randomUUID();
    trackPendingFunding({
      id: requestId,
      requestId,
      pubkey: currentUser.pubkey,
      amountMinor,
      rail: 'lightning'
    });
    try {
      const quote = await createUsdLightningMintQuote(proofMintUrl(), amountMinor, {
        description: `Cascade portfolio funding for ${currentUser.pubkey}`,
        pubkey: currentUser.pubkey,
        requestId
      });
      patchPendingFunding(requestId, {
        fundingId: quote.quote,
        status: 'invoice_pending',
        invoice: quote.request
      });
      refreshLocalFundingState();
      status = `Lightning payment ready for ${formatUsdMinor(amountMinor)}.`;
      await reconcilePendingFundings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lightning funding quote creation failed.';
      if (message === 'wallet_funding_request_in_progress') {
        status = `Restoring your Lightning payment for ${formatUsdMinor(amountMinor)}.`;
      } else {
        clearPendingFunding(requestId);
        errorMessage = formatSignetFundingError(message);
        status = '';
      }
    }
  }

  async function createStripeCheckout() {
    if (!currentUser) {
      errorMessage = `Sign in before starting funding for your ${portfolioLabel}.`;
      return;
    }

    if (!stripeFundingAvailable) {
      errorMessage = railUnavailableMessage('stripe');
      return;
    }

    const amountMinor = Number.parseInt(fundingAmount, 10) || 0;
    if (amountMinor <= 0) {
      errorMessage = 'Enter a card funding amount greater than zero.';
      return;
    }

    status = `Preparing card checkout for ${formatUsdMinor(amountMinor)}.`;
    errorMessage = '';
    const requestId = crypto.randomUUID();
    trackPendingFunding({
      id: requestId,
      requestId,
      pubkey: currentUser.pubkey,
      amountMinor,
      rail: 'stripe'
    });

    try {
      const response = await createStripeFunding({
        pubkey: currentUser.pubkey,
        amountMinor,
        requestId
      });
      const funding = await parseJson<ProductPortfolioFunding>(
        response,
        'Stripe funding creation failed.'
      );

      patchPendingFunding(requestId, {
        fundingId: funding.id,
        status: funding.status,
        checkoutUrl: funding.checkout_url ?? undefined,
        checkoutSessionId: funding.checkout_session_id ?? undefined,
        checkoutExpiresAt: funding.checkout_expires_at ?? undefined
      });
      refreshLocalFundingState();

      if (funding.status === 'complete') {
        recordFundingHistory({
          id: requestId,
          fundingId: funding.id,
          pubkey: currentUser.pubkey,
          amountMinor,
          rail: 'stripe',
          status: funding.status,
          checkoutUrl: funding.checkout_url ?? undefined,
          checkoutSessionId: funding.checkout_session_id ?? undefined,
          checkoutExpiresAt: funding.checkout_expires_at ?? undefined,
          createdAt: Date.now()
        });
        clearPendingFunding(requestId);
        refreshLocalFundingState();
        status = `Card payment confirmed for ${formatUsdMinor(amountMinor)}. Adding funds on this device is not available for card payments yet.`;
        return;
      }

      status = `Card checkout ready for ${formatUsdMinor(amountMinor)}.`;
      if (browser && funding.checkout_url) {
        window.location.assign(funding.checkout_url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe funding creation failed.';
      if (message === 'wallet_funding_request_in_progress') {
        status = `Restoring card checkout for ${formatUsdMinor(amountMinor)}.`;
      } else if (message === 'stripe_fundings_unavailable') {
        clearPendingFunding(requestId);
        errorMessage = 'Card funding is not available right now.';
        status = '';
      } else {
        clearPendingFunding(requestId);
        errorMessage = formatStripeFundingError(message);
        status = '';
      }
    }
  }

  async function refreshPendingFundings() {
    if (!currentUser) {
      return;
    }

    status = 'Refreshing payment status.';
    errorMessage = '';
    await reconcilePendingFundings();
  }

  async function reconcilePendingFundings() {
    if (!currentUser) return;

    const trackedFundings = listPendingFundings(currentUser.pubkey);
    if (!trackedFundings.length) return;

    let walletNeedsRefresh = false;

    for (const trackedFunding of trackedFundings) {
      try {
        if (trackedFunding.rail === 'lightning') {
          let recoveredQuoteId = trackedFunding.fundingId;
          if (trackedFunding.requestId && !trackedFunding.fundingId) {
            const quote = await recoverLightningQuote(trackedFunding);
            if (!quote) {
              continue;
            }

            patchPendingFunding(trackedFunding.id, {
              fundingId: quote.quote,
              status: quote.state === 'UNPAID' ? 'invoice_pending' : quote.state.toLowerCase(),
              invoice: quote.request
            });
            recoveredQuoteId = quote.quote;
          }

          const quoteId = recoveredQuoteId;
          if (!quoteId) {
            continue;
          }
          const quote = await checkUsdLightningMintQuote(proofMintUrl(), quoteId);

          if (quote.state === 'UNPAID') {
            patchPendingFunding(trackedFunding.id, {
              status: 'invoice_pending',
              invoice: quote.request
            });
            if (!trackedFunding.pendingNotified) {
              status = `${fundingRailLabel(trackedFunding.rail)} payment still pending for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
              markPendingFundingNotified(trackedFunding.id);
            }
            continue;
          }

          if (quote.state === 'PAID') {
            patchPendingFunding(trackedFunding.id, {
              status: 'paid',
              invoice: quote.request
            });
            const preparation =
              trackedFunding.mintPreparation ??
              (await prepareUsdLightningMint(proofMintUrl(), quote.amount));
            if (!trackedFunding.mintPreparation) {
              attachPendingFundingMintPreparation(trackedFunding.id, preparation);
            }

            const minted = await mintUsdLightningQuote(
              proofMintUrl(),
              quote.quote,
              quote.amount,
              preparation
            );
            recordFundingHistory({
              id: trackedFunding.id,
              fundingId: quote.quote,
              pubkey: trackedFunding.pubkey,
              amountMinor: quote.amount,
              rail: trackedFunding.rail,
              status: 'complete',
              invoice: quote.request,
              createdAt: trackedFunding.createdAt
            });
            clearPendingFunding(trackedFunding.id);
            walletNeedsRefresh = true;
            applyIssuedProofs(minted.proofs, 'Recovered Lightning funding');
            continue;
          }

          if (quote.state === 'ISSUED') {
            if (!trackedFunding.mintPreparation) {
              recordFundingHistory({
                id: trackedFunding.id,
                fundingId: quote.quote,
                pubkey: trackedFunding.pubkey,
                amountMinor: quote.amount,
                rail: trackedFunding.rail,
                status: 'complete',
                invoice: quote.request,
                createdAt: trackedFunding.createdAt
              });
              clearPendingFunding(trackedFunding.id);
              walletNeedsRefresh = true;
              status = `Lightning payment completed for ${formatUsdMinor(trackedFunding.amountMinor)}, but this device can no longer restore those funds automatically.`;
              continue;
            }

            const proofs = await restoreUsdLightningQuote(
              proofMintUrl(),
              trackedFunding.mintPreparation
            );
            recordFundingHistory({
              id: trackedFunding.id,
              fundingId: quote.quote,
              pubkey: trackedFunding.pubkey,
              amountMinor: quote.amount,
              rail: trackedFunding.rail,
              status: 'complete',
              invoice: quote.request,
              createdAt: trackedFunding.createdAt
            });
            clearPendingFunding(trackedFunding.id);
            walletNeedsRefresh = true;
            applyIssuedProofs(proofs, 'Recovered Lightning funding');
            continue;
          }
        }

        let funding: ProductPortfolioFunding | null = null;

        if (trackedFunding.requestId && !trackedFunding.fundingId) {
          const requestResponse = await fetchPortfolioFundingRequestStatus(trackedFunding.requestId);
          const requestStatus = await parseJson<ProductPortfolioFundingRequestStatus>(
            requestResponse,
            `Failed to recover the ${fundingLabel(trackedFunding.rail).toLowerCase()} status.`
          );

          if (requestStatus.status === 'pending') {
            if (!trackedFunding.pendingNotified) {
              status = `${fundingRailLabel(trackedFunding.rail)} payment still pending for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
              markPendingFundingNotified(trackedFunding.id);
            }
            continue;
          }

          if (requestStatus.status === 'failed') {
            recordFundingHistory({
              id: trackedFunding.id,
              fundingId: trackedFunding.fundingId,
              pubkey: trackedFunding.pubkey,
              amountMinor: trackedFunding.amountMinor,
              rail: trackedFunding.rail,
              status: 'failed',
              createdAt: trackedFunding.createdAt
            });
            clearPendingFunding(trackedFunding.id);
            refreshLocalFundingState();
            errorMessage =
              requestStatus.error || `${fundingLabel(trackedFunding.rail)} creation failed.`;
            continue;
          }

          funding = requestStatus.funding || null;
          if (funding?.id) {
            patchPendingFunding(trackedFunding.id, {
              fundingId: funding.id,
              status: funding.status,
              invoice: funding.invoice ?? undefined,
              paymentHash: funding.payment_hash ?? undefined,
              checkoutUrl: funding.checkout_url ?? undefined,
              checkoutSessionId: funding.checkout_session_id ?? undefined,
              checkoutExpiresAt: funding.checkout_expires_at ?? undefined
            });
          }
        }

        if (!funding) {
          const fundingId = trackedFunding.fundingId ?? trackedFunding.id;
          const response = await fetchPortfolioFundingStatus(fundingId);
          funding = await parseJson<ProductPortfolioFunding>(
            response,
            `Failed to recover the ${fundingLabel(trackedFunding.rail).toLowerCase()} status.`
          );
        }

        if (isPendingFundingStatus(funding.status)) {
          patchPendingFunding(trackedFunding.id, {
            fundingId: funding.id,
            status: funding.status,
            invoice: funding.invoice ?? undefined,
            paymentHash: funding.payment_hash ?? undefined,
            checkoutUrl: funding.checkout_url ?? undefined,
            checkoutSessionId: funding.checkout_session_id ?? undefined,
            checkoutExpiresAt: funding.checkout_expires_at ?? undefined
          });
          if (!trackedFunding.pendingNotified) {
            status = `${fundingRailLabel(funding.rail)} payment still pending for ${formatUsdMinor(funding.amount_minor)}.`;
            markPendingFundingNotified(trackedFunding.id);
          }
          continue;
        }

        recordFundingHistory({
          id: trackedFunding.id,
          fundingId: funding.id,
          pubkey: trackedFunding.pubkey,
          amountMinor: funding.amount_minor,
          rail: trackedFunding.rail,
          status: funding.status,
          invoice: funding.invoice ?? undefined,
          paymentHash: funding.payment_hash ?? undefined,
          checkoutUrl: funding.checkout_url ?? undefined,
          checkoutSessionId: funding.checkout_session_id ?? undefined,
          checkoutExpiresAt: funding.checkout_expires_at ?? undefined,
          createdAt: trackedFunding.createdAt
        });
        clearPendingFunding(trackedFunding.id);
        walletNeedsRefresh = true;

        if (funding.status === 'complete') {
          status = `Payment confirmed for ${formatUsdMinor(funding.amount_minor)}. This device cannot finish adding those funds automatically for that payment method yet.`;
        } else {
          status =
            funding.status === 'review_required'
              ? `${fundingRailLabel(funding.rail)} payment is under review for ${formatUsdMinor(funding.amount_minor)}. No funds were added.`
              : `${fundingRailLabel(funding.rail)} payment ${funding.status.replace(/_/g, ' ')} for ${formatUsdMinor(funding.amount_minor)}.`;
        }
      } catch (error) {
        console.error('pending_funding_reconcile_failed', trackedFunding, error);
        // Keep tracked fundings in storage until the status endpoint is reachable again.
      }
    }

    if (walletNeedsRefresh) {
      await refreshPortfolioView();
    } else {
      refreshLocalFundingState();
    }
  }

  $effect(() => {
    if (!browser) return;
    refreshLocalProofSummary();
    refreshLocalFundingState();
  });

  $effect(() => {
    if (!browser || !currentUser) return;
    void (async () => {
      await refreshPortfolioView();
      await reconcilePendingFundings();
    })();
  });

  $effect(() => {
    if (!browser || !currentUser) return;

    const interval = window.setInterval(() => {
      void reconcilePendingFundings();
    }, 1000);

    return () => window.clearInterval(interval);
  });
</script>

<section class="wallet-page">
  <header class="wallet-header">
    <div class="eyebrow">Portfolio</div>
    <h1>Your portfolio</h1>
    <p>
      This portfolio tracks the cash and positions available on this device. Cash is ready to
      trade, and position values follow current public market prices. Exact withdrawal proceeds can
      differ based on trade size.
    </p>
  </header>

  {#if !currentUser}
    <section class="wallet-panel">
      <h2>Connect to view your portfolio</h2>
      <p class="muted">Track your cash, positions, and current value from this device.</p>
      <a class="btn btn-primary w-fit" href="/join">Connect</a>
    </section>
  {:else}
    <section class="wallet-grid">
      <article class="wallet-panel">
        <span class="label">Your balance</span>
        <strong>{formatUsdMinor(localBalanceMinor)}</strong>
        <p class="muted">Cash available to trade from this device.</p>
      </article>

      <article class="wallet-panel">
        <span class="label">Position Mark</span>
        <strong>{formatUsdMinor(displayedPositionValueMinor)}</strong>
        <p class="muted">
          {#if usingLocalPositionMarks}
            Estimated from your current positions on this device and current public market prices.
          {:else}
            No positions found on this device yet.
          {/if}
        </p>
      </article>

      <article class="wallet-panel">
        <span class="label">Current Value</span>
        <strong>{formatUsdMinor(displayedTotalValueMinor)}</strong>
        <p class="muted">
          Cash plus current position marks. Exact withdrawal proceeds can differ based on trade size.
        </p>
      </article>
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Add funds</h2>
          <p class="muted">
            Add funds to your balance with Stripe or Lightning.
            {#if paperEdition}
              In practice mode, each payment is capped at {formatUsdMinor(signetFundingSingleLimitMinor)}
              per funding request and {formatUsdMinor(signetFundingWindowLimitMinor)} per 24 hours.
            {/if}
          </p>
          {#if !runtime.funding.lightning.available}
            <p class="muted">{railUnavailableMessage('lightning')}</p>
          {:else if stripeFundingEnabled && !runtime.funding.stripe.available}
            <p class="muted">{railUnavailableMessage('stripe')}</p>
          {/if}
        </div>
      </div>

      <div class="funding-row">
        <label class="grid w-full max-w-64 gap-2">
          <span class="text-xs font-medium tracking-[0.08em] text-base-content/50 uppercase">Amount</span>
          <input
            class="input input-bordered"
            aria-label="Amount"
            bind:value={fundingAmount}
            min="100"
            step="100"
            type="number"
          />
        </label>
        {#if stripeFundingEnabled}
          <button
            class="btn btn-primary"
            disabled={!stripeFundingAvailable}
            onclick={createStripeCheckout}
            type="button"
          >
            Checkout with card
          </button>
        {/if}
        <button
          class="btn btn-outline"
          disabled={!lightningFundingAvailable}
          onclick={createLightningFunding}
          type="button"
        >
          Add funds with Lightning
        </button>
      </div>

      {#if pendingFundings.length}
        <div class="history-list">
          {#each pendingFundings as funding (funding.id)}
            <div class="history-row history-row-stack">
              <div class="history-copy">
                <strong>{formatUsdMinor(funding.amount_minor)}</strong>
                <p class="muted">
                  {fundingRailLabel(funding.rail)} · {fundingStatusLabel(funding.status, funding.rail)}
                </p>
                {#if funding.invoice}
                  <div class="funding-payment-card">
                    <QRCode value={funding.invoice} size={128} />
                    <div class="funding-payment-copy">
                      <span>Payment code</span>
                      <div class="proof-transfer-actions">
                        <a class="btn btn-outline" href={`lightning:${funding.invoice}`}>Open wallet</a>
                        <CopyButton text={funding.invoice} label="Copy payment code" />
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
              <div class="proof-transfer-actions">
                {#if funding.checkout_url}
                  <a class="btn btn-outline" href={funding.checkout_url}>Open checkout</a>
                {/if}
                <button class="btn btn-outline" onclick={refreshPendingFundings} type="button">
                  Refresh status
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No pending payments.</p>
      {/if}
    </section>

    <section class="wallet-panel">
      <div class="panel-header">
        <div>
          <h2>Open positions</h2>
          <p class="muted">
            {#if usingLocalPositionMarks}
              Position size comes from what this device can withdraw right now. Cost basis comes from trades placed here. Current value uses public market prices.
            {:else}
              No positions found on this device yet.
            {/if}
          </p>
        </div>
        <a class="btn btn-outline" href="/builder">Create market</a>
      </div>

      {#if localPositions.length}
        <div class="position-list">
          {#each localPositions as position (position.market_slug + position.direction)}
            <a class="position-row" href={`/market/${position.market_slug}`}>
              <div class="position-copy">
                <strong>{position.market_title}</strong>
                <p>{position.direction === 'long' ? 'LONG' : 'SHORT'} · {position.quantity.toFixed(2)} shares · {describePositionPrice(position)}</p>
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

      {#if fundingHistory.length}
        <div class="history-list">
          {#each fundingHistory as event (event.id)}
            <div class="history-row">
              <div>
                <strong>{formatUsdMinor(event.amountMinor)}</strong>
                <p class="muted">{fundingRailLabel(event.rail)} · {fundingStatusLabel(event.status, event.rail)}</p>
              </div>
              <span class="muted">{formatDateTime(Math.floor(event.createdAt / 1000))}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No funding activity yet.</p>
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
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .wallet-panel strong {
    font-size: 1.5rem;
    color: white;
    font-family: var(--font-mono);
  }

  .label {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .muted {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
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

  .position-list,
  .history-list {
    display: grid;
    gap: 0;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .position-row,
  .history-row {
    padding: 0.85rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
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

  .position-copy,
  .position-metrics {
    display: grid;
    gap: 0.35rem;
  }

  .funding-payment-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 0;
  }

  .funding-payment-copy {
    display: grid;
    gap: 0.5rem;
  }

  .funding-payment-copy > span {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .proof-transfer-actions {
    display: grid;
    grid-auto-flow: column;
    gap: 0.75rem;
    align-items: center;
  }

  .position-metrics {
    justify-items: end;
    font-family: var(--font-mono);
  }

  .positive {
    color: var(--color-base-content-success);
  }

  .negative {
    color: var(--color-base-content-danger);
  }

  .wallet-status,
  .wallet-error {
    margin: 0;
    font-size: 0.95rem;
  }

  .wallet-status {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .wallet-error {
    color: var(--color-base-content-danger);
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

    .proof-transfer-actions {
      grid-auto-flow: row;
    }

    .funding-payment-card {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
