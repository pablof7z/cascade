<script lang="ts">
  import { browser } from '$app/environment';
  import {
    createStripeFunding,
    fetchMarketDetailBySlug,
    fetchPortfolioFundingRequestStatus,
    fetchPortfolioFundingStatus,
    fetchProductRuntime,
    parseJson,
    type ProductMarketDetail,
    type ProductProof,
    type ProductRuntime,
    type ProductPortfolioFunding,
    type ProductPortfolioFundingRequestStatus
  } from '$lib/cascade/api';
  import { getProductApiUrl, isPaperEdition, isStripeFundingEnabled } from '$lib/cascade/config';
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
  import { decodeLocalProofToken, encodeLocalProofWallet } from '$lib/wallet/cashuTokens';
  import {
    checkUsdLightningMintQuote,
    createUsdLightningMintQuote,
    mintUsdLightningQuote,
    prepareUsdLightningMint,
    restoreUsdLightningQuote
  } from '$lib/wallet/cashuMint';
  import {
    addLocalProofs,
    listLocalProofs,
    listLocalProofWallets,
    localProofBalance,
    type StoredProofWallet
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
    direction: 'yes' | 'no';
    quantity: number;
    current_price_ppm: number;
    market_value_minor: number;
    cost_basis_minor: number | null;
    unrealized_pnl_minor: number | null;
  };

  const currentUser = $derived(ndk.$currentUser);
  const paperEdition = isPaperEdition();
  const stripeFundingEnabled = isStripeFundingEnabled();
  const editionLabel = paperEdition ? 'Signet' : 'Mainnet';
  const portfolioLabel = paperEdition ? 'signet portfolio' : 'portfolio';

  const proofUnit = 'usd';
  const signetFundingSingleLimitMinor = 10000;
  const signetFundingWindowLimitMinor = 25000;

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
  let pendingFundings = $state<LocalPendingFunding[]>([]);
  let fundingHistory = $state<LocalFundingHistoryRecord[]>([]);
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
  const lightningFundingAvailable = $derived(
    runtime !== null && !runtimeEditionMismatch && runtime.funding.lightning.available
  );
  const stripeFundingAvailable = $derived(
    stripeFundingEnabled &&
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
    if (configuredReason === 'stripe_fundings_unavailable') {
      return 'Stripe funding is not configured for this edition yet.';
    }
    if (configuredReason === 'lightning_fundings_unavailable') {
      return 'Lightning funding is not configured for this edition yet.';
    }

    return rail === 'stripe'
      ? 'Stripe funding is unavailable for this edition right now.'
      : 'Lightning funding is unavailable for this edition right now.';
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

  function formatSignetFundingError(message: string): string {
    if (message.startsWith('signet_funding_single_limit_exceeded')) {
      return `Signet funding is capped at ${formatUsdMinor(signetFundingSingleLimitMinor)} per funding request.`;
    }

    if (message.startsWith('signet_funding_window_limit_exceeded')) {
      return `Signet funding is capped at ${formatUsdMinor(signetFundingWindowLimitMinor)} per 24 hours.`;
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
    return rail === 'stripe' ? 'Stripe funding' : 'Lightning funding';
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
          status = `Recovered pending ${fundingLabel(trackedFunding.rail).toLowerCase()} for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
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
      errorMessage = 'Enter a Lightning funding amount greater than zero.';
      return;
    }

    status = `Creating a Lightning mint quote for ${formatUsdMinor(amountMinor)}.`;
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
      status = `Created a Lightning funding quote for ${formatUsdMinor(amountMinor)}.`;
      await reconcilePendingFundings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lightning funding quote creation failed.';
      if (message === 'wallet_funding_request_in_progress') {
        status = `Recovering the Lightning funding quote for ${formatUsdMinor(amountMinor)}.`;
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
      errorMessage = 'Enter a Stripe funding amount greater than zero.';
      return;
    }

    status = `Creating Stripe funding for ${formatUsdMinor(amountMinor)}.`;
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
        status = `Stripe funding settled for ${formatUsdMinor(amountMinor)}. Claiming browser-local proofs for card funding is not enabled yet.`;
        return;
      }

      status = `Created Stripe funding for ${formatUsdMinor(amountMinor)}.`;
      if (browser && funding.checkout_url) {
        window.location.assign(funding.checkout_url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe funding creation failed.';
      if (message === 'wallet_funding_request_in_progress') {
        status = `Recovering Stripe funding for ${formatUsdMinor(amountMinor)}.`;
      } else if (message === 'stripe_fundings_unavailable') {
        clearPendingFunding(requestId);
        errorMessage = 'Stripe funding is not configured for this edition yet.';
        status = '';
      } else {
        clearPendingFunding(requestId);
        errorMessage = formatStripeFundingError(message);
        status = '';
      }
    }
  }

  async function refreshPendingFundings() {
    if (!runtime || runtimeEditionMismatch) {
      errorMessage = railUnavailableMessage('lightning');
      return;
    }

    status = 'Refreshing pending funding requests.';
    errorMessage = '';
    await reconcilePendingFundings();
  }

  async function reconcilePendingFundings() {
    if (!currentUser || !runtime || runtimeEditionMismatch) return;

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
              status = `Recovered pending ${fundingLabel(trackedFunding.rail).toLowerCase()} for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
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
              status = `Recovered issued Lightning funding for ${formatUsdMinor(trackedFunding.amountMinor)}, but this browser no longer has the local mint recovery data.`;
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
              status = `Recovered pending ${fundingLabel(trackedFunding.rail).toLowerCase()} for ${formatUsdMinor(trackedFunding.amountMinor)}.`;
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
            status = `Recovered pending ${fundingLabel(funding.rail).toLowerCase()} for ${formatUsdMinor(funding.amount_minor)}.`;
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
          status = `Recovered ${fundingLabel(funding.rail).toLowerCase()} settlement for ${formatUsdMinor(funding.amount_minor)}. Browser-local proof claiming for this rail is not enabled yet.`;
        } else {
          status =
            funding.status === 'review_required'
              ? `Recovered ${fundingLabel(funding.rail).toLowerCase()} under review for ${formatUsdMinor(funding.amount_minor)}. No proofs were issued.`
              : `Recovered ${funding.status.replace(/_/g, ' ')} ${fundingLabel(funding.rail).toLowerCase()} for ${formatUsdMinor(funding.amount_minor)}.`;
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
    void loadRuntime();
  });

  $effect(() => {
    if (!browser || !currentUser || !runtime) return;
    void (async () => {
      await refreshPortfolioView();
      await reconcilePendingFundings();
    })();
  });

  $effect(() => {
    if (!browser || !currentUser || !runtime || runtimeEditionMismatch) return;

    const interval = window.setInterval(() => {
      void reconcilePendingFundings();
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
      <h2>Connect to view your portfolio</h2>
      <p class="muted">Trade markets, track your positions, and keep your proofs in this browser.</p>
      <a class="button-primary" href="/join">Connect</a>
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
              In signet, funding still follows the normal pending-funding lifecycle. Limit {formatUsdMinor(signetFundingSingleLimitMinor)}
              per funding request and {formatUsdMinor(signetFundingWindowLimitMinor)} per 24 hours.
            {/if}
          </p>
          {#if !runtimeNotice && runtime && !runtime.funding.lightning.available}
            <p class="muted">{railUnavailableMessage('lightning')}</p>
          {:else if stripeFundingEnabled && runtime && !runtime.funding.stripe.available}
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
        {#if stripeFundingEnabled}
          <button
            class="button-primary"
            disabled={!stripeFundingAvailable}
            onclick={createStripeCheckout}
            type="button"
          >
            Checkout with card
          </button>
        {/if}
        <button
          class="button-secondary"
          disabled={!lightningFundingAvailable}
          onclick={createLightningFunding}
          type="button"
        >
          Create Lightning invoice
        </button>
      </div>

      {#if pendingFundings.length}
        <div class="history-list">
          {#each pendingFundings as funding (funding.id)}
            <div class="history-row history-row-stack">
              <div class="history-copy">
                <strong>{formatUsdMinor(funding.amount_minor)}</strong>
                <p class="muted">
                  {funding.rail} · {funding.status}
                </p>
                {#if funding.invoice}
                  <code>{funding.invoice}</code>
                {/if}
                {#if funding.checkout_session_id}
                  <p class="muted">Checkout session {funding.checkout_session_id}</p>
                {/if}
              </div>
              <div class="proof-transfer-actions">
                {#if funding.checkout_url}
                  <a class="button-secondary" href={funding.checkout_url}>Open checkout</a>
                {/if}
                <button class="button-secondary" onclick={refreshPendingFundings} type="button">
                  Refresh status
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No pending funding requests.</p>
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
          <h2>Recent funding activity</h2>
        </div>
      </div>

      {#if fundingHistory.length}
        <div class="history-list">
          {#each fundingHistory as event (event.id)}
            <div class="history-row">
              <div>
                <strong>{formatUsdMinor(event.amountMinor)}</strong>
                <p class="muted">{event.rail} · {event.status}</p>
              </div>
              <span class="muted">{new Date(event.createdAt).toLocaleString()}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No local funding activity recorded in this browser yet.</p>
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
