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
  import { formatUsdMinor } from '$lib/cascade/format';
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

  function fundingStatusLabel(fundingStatus: string, rail: string): string {
    switch (fundingStatus) {
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
        return fundingStatus.replace(/_/g, ' ');
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

  function isPendingFundingStatus(fundingStatus: string): boolean {
    return fundingStatus === 'invoice_pending' || fundingStatus === 'pending';
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

<section class="grid gap-6 py-10 pb-16 w-[min(calc(100%-2.5rem),68rem)] mx-auto">
  <header class="grid gap-3">
    <div class="eyebrow">Portfolio</div>
    <h1 class="text-4xl font-bold tracking-tight">Your portfolio</h1>
    <p class="text-base-content/60 max-w-prose">
      This portfolio tracks the cash and positions available on this device. Cash is ready to
      trade, and position values follow current public market prices. Exact withdrawal proceeds can
      differ based on trade size.
    </p>
  </header>

  {#if !currentUser}
    <div class="card card-border bg-base-200">
      <div class="card-body gap-4">
        <h2 class="card-title">Connect to view your portfolio</h2>
        <p class="text-base-content/60">Track your cash, positions, and current value from this device.</p>
        <a class="btn btn-primary w-fit" href="/join">Connect</a>
      </div>
    </div>
  {:else}
    <!-- Summary stats -->
    <div class="stats stats-horizontal w-full bg-base-200">
      <div class="stat">
        <div class="stat-title">Your balance</div>
        <div class="stat-value font-mono text-2xl">{formatUsdMinor(localBalanceMinor)}</div>
        <div class="stat-desc">Cash available to trade from this device.</div>
      </div>

      <div class="stat">
        <div class="stat-title">Position Mark</div>
        <div class="stat-value font-mono text-2xl">{formatUsdMinor(displayedPositionValueMinor)}</div>
        <div class="stat-desc">
          {#if usingLocalPositionMarks}
            Estimated from current positions and market prices.
          {:else}
            No positions found on this device yet.
          {/if}
        </div>
      </div>

      <div class="stat">
        <div class="stat-title">Current Value</div>
        <div class="stat-value font-mono text-2xl">{formatUsdMinor(displayedTotalValueMinor)}</div>
        <div class="stat-desc">Cash plus position marks.</div>
      </div>
    </div>

    <!-- Add funds -->
    <section class="card card-border bg-base-200">
      <div class="card-body gap-4">
        <div>
          <h2 class="card-title">Add funds</h2>
          <p class="text-base-content/60 text-sm mt-1">
            Add funds to your balance with Stripe or Lightning.
            {#if paperEdition}
              In practice mode, each payment is capped at {formatUsdMinor(signetFundingSingleLimitMinor)}
              per funding request and {formatUsdMinor(signetFundingWindowLimitMinor)} per 24 hours.
            {/if}
          </p>
          {#if !runtime.funding.lightning.available}
            <p class="text-sm text-base-content/60 mt-1">{railUnavailableMessage('lightning')}</p>
          {:else if stripeFundingEnabled && !runtime.funding.stripe.available}
            <p class="text-sm text-base-content/60 mt-1">{railUnavailableMessage('stripe')}</p>
          {/if}
        </div>

        <div class="flex flex-wrap items-end gap-4">
          <label class="form-control w-full max-w-64">
            <div class="label"><span class="label-text">Amount</span></div>
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
          <div class="grid gap-0 border-t border-base-300 mt-2">
            {#each pendingFundings as funding (funding.id)}
              <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
                <div class="grid gap-2">
                  <strong class="font-mono">{formatUsdMinor(funding.amount_minor)}</strong>
                  <p class="text-sm text-base-content/60">
                    {fundingRailLabel(funding.rail)} · {fundingStatusLabel(funding.status, funding.rail)}
                  </p>
                  {#if funding.invoice}
                    <div class="flex items-center gap-4 py-2">
                      <QRCode value={funding.invoice} size={128} />
                      <div class="grid gap-2">
                        <span class="eyebrow">Payment code</span>
                        <div class="flex gap-3">
                          <a class="btn btn-outline btn-sm" href={`lightning:${funding.invoice}`}>Open wallet</a>
                          <CopyButton text={funding.invoice} label="Copy payment code" />
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
                <div class="flex gap-3">
                  {#if funding.checkout_url}
                    <a class="btn btn-outline btn-sm" href={funding.checkout_url}>Open checkout</a>
                  {/if}
                  <button class="btn btn-outline btn-sm" onclick={refreshPendingFundings} type="button">
                    Refresh status
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-base-content/60">No pending payments.</p>
        {/if}
      </div>
    </section>

    <!-- Open positions -->
    <section class="card card-border bg-base-200">
      <div class="card-body gap-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="card-title">Open positions</h2>
            <p class="text-sm text-base-content/60 mt-1">
              {#if usingLocalPositionMarks}
                Position size comes from what this device can withdraw right now. Cost basis comes from trades placed here.
              {:else}
                No positions found on this device yet.
              {/if}
            </p>
          </div>
          <a class="btn btn-outline btn-sm" href="/builder">Create market</a>
        </div>

        {#if localPositions.length}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Direction</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th class="text-right">Value</th>
                  <th class="text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {#each localPositions as position (position.market_slug + position.direction)}
                  <tr>
                    <td>
                      <a href={`/market/${position.market_slug}`} class="font-medium hover:text-primary">
                        {position.market_title}
                      </a>
                    </td>
                    <td>
                      <span class="badge badge-outline badge-sm" class:badge-success={position.direction === 'long'} class:badge-error={position.direction === 'short'}>
                        {position.direction === 'long' ? 'LONG' : 'SHORT'}
                      </span>
                    </td>
                    <td class="font-mono text-sm">{position.quantity.toFixed(2)}</td>
                    <td class="font-mono text-sm">{describePositionPrice(position)}</td>
                    <td class="font-mono text-sm text-right">{formatUsdMinor(position.market_value_minor)}</td>
                    <td class="font-mono text-sm text-right">
                      {#if position.unrealized_pnl_minor === null || position.unrealized_pnl_minor === undefined}
                        <span class="text-base-content/50">Mark only</span>
                      {:else}
                        <span class:text-success={position.unrealized_pnl_minor >= 0} class:text-error={position.unrealized_pnl_minor < 0}>
                          {position.unrealized_pnl_minor >= 0 ? '+' : ''}{formatUsdMinor(Math.abs(position.unrealized_pnl_minor))}
                        </span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if loading}
          <p class="text-sm text-base-content/60">Loading portfolio state.</p>
        {:else}
          <p class="text-sm text-base-content/60">No open positions yet.</p>
        {/if}
      </div>
    </section>

    <!-- Funding history -->
    <section class="card card-border bg-base-200">
      <div class="card-body gap-4">
        <h2 class="card-title">Funding history</h2>

        {#if fundingHistory.length}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Rail</th>
                  <th>Status</th>
                  <th class="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {#each fundingHistory as event (event.id)}
                  <tr>
                    <td class="font-mono">{formatUsdMinor(event.amountMinor)}</td>
                    <td>{fundingRailLabel(event.rail)}</td>
                    <td>{fundingStatusLabel(event.status, event.rail)}</td>
                    <td class="text-right text-sm text-base-content/60">{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm text-base-content/60">No funding activity yet.</p>
        {/if}
      </div>
    </section>
  {/if}

  {#if status}
    <div class="alert"><span class="text-sm">{status}</span></div>
  {/if}
  {#if errorMessage}
    <div class="alert alert-error"><span class="text-sm">{errorMessage}</span></div>
  {/if}
</section>
