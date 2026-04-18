<script lang="ts">
  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    buyMarketPosition,
    extractTradeBlindSignatureBundles,
    fetchTradeQuoteStatus,
    quoteBuyTrade,
    quoteSellTrade,
    fetchTradeRequestStatus,
    fetchTradeStatus,
    hasCompletedTradeSettlement,
    parseJson,
    sellMarketPosition,
    type ProductTradeQuote,
    type ProductTradeExecution,
    type ProductTradeRequestStatus,
    type ProductTradeStatus
  } from '$lib/cascade/api';
  import { getCascadeEdition, getProductApiUrl } from '$lib/cascade/config';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { shareMinorToQuantity } from '$lib/cascade/shares';
  import { normalizeProductTradeSide } from '$lib/cascade/tradeSide';
  import {
    attachTradeReceiptQuoteId,
    clearTradeReceipt,
    listTradeReceipts,
    markTradeReceiptTradeId,
    trackTradeReceipt
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';
  import {
    addLocalProofs,
    localProofBalance,
    removeLocalProofs,
    selectLocalProofsForAmount
  } from '$lib/wallet/localProofs';
  import {
    prepareProofOutputs,
    restorePreparedOutputs,
    unblindPreparedOutputs
  } from '$lib/wallet/cashuMint';
  import { applyLocalPositionTradeFromPayload } from '$lib/wallet/localPositionBook';
  import { TradePanelState } from './tradePanelState';

  let {
    marketId,
    marketSlug,
    yesProbability,
    noProbability
  }: {
    marketId: string;
    marketSlug: string;
    yesProbability: number;
    noProbability: number;
  } = $props();

  const currentUser = $derived(ndk.$currentUser);
  const selectedEdition = $derived(getCascadeEdition(page.data.cascadeEdition ?? null));

  let availableMinor = $state(0);
  let buySide = $state<'long' | 'short'>('long');
  let buySpend = $state('2500');
  let sellQuantity = $state('');
  let tradePanelState = $state<TradePanelState>(TradePanelState.Idle);
  let statusMessage = $state('');
  let errorMessage = $state('');
  let tradeMode = $state<'mint' | 'exit'>('mint');
  let validationError = $state('');
  let tradePreview = $state<{ quantity?: number; amount?: number } | null>(null);

  const currentPosition = $derived.by(() => {
    const yesQuantity = shareMinorToQuantity(
      localProofBalance(proofMintUrl(), marketUnitForSide('long'))
    );
    const noQuantity = shareMinorToQuantity(
      localProofBalance(proofMintUrl(), marketUnitForSide('short'))
    );

    if (yesQuantity > 0 && noQuantity > 0) {
      return buySide === 'short'
        ? { side: 'short' as const, quantity: noQuantity }
        : { side: 'long' as const, quantity: yesQuantity };
    }

    if (yesQuantity > 0) {
      return { side: 'long' as const, quantity: yesQuantity };
    }

    if (noQuantity > 0) {
      return { side: 'short' as const, quantity: noQuantity };
    }

    return null;
  });

  const hasPosition = $derived(currentPosition !== null);
  const maxBuyAmount = $derived(formatUsdMinor(availableMinor));
  const parsedBuySpend = $derived(Number.parseInt(buySpend, 10) || 0);
  const parsedSellQuantity = $derived(Number.parseFloat(sellQuantity) || 0);
  const buySpendValid = $derived(parsedBuySpend >= 100 && parsedBuySpend <= availableMinor);
  const sellQuantityValid = $derived(
    hasPosition && parsedSellQuantity > 0 && parsedSellQuantity <= (currentPosition?.quantity ?? 0)
  );

  function proofMintUrl(): string {
    return getProductApiUrl(selectedEdition).replace(/\/+$/, '');
  }

  function marketUnitForSide(side: 'long' | 'short'): string {
    return side === 'long' ? `long_${marketSlug}` : `short_${marketSlug}`;
  }

  function createTradeRequestId(): string {
    if (browser && typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${marketId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  function refreshLocalWallet() {
    availableMinor = localProofBalance(proofMintUrl(), 'usd');
  }

  async function loadWallet() {
    if (!currentUser) return;
    refreshLocalWallet();
  }

  function setTradeState(nextState: TradePanelState) {
    tradePanelState = nextState;
  }

  function setTradeStatus(nextState: TradePanelState, message: string) {
    tradePanelState = nextState;
    statusMessage = message;
  }

  function setTradeError(message: string, options: { clearStatus?: boolean } = {}) {
    tradePanelState = TradePanelState.Error;
    errorMessage = message;
    if (options.clearStatus) {
      statusMessage = '';
    }
  }

  function clearTradeError() {
    errorMessage = '';
  }

  function validateBuyAmount(): boolean {
    const spendMinor = Number.parseInt(buySpend, 10) || 0;
    if (spendMinor <= 0) {
      validationError = 'Enter an amount greater than zero';
      return false;
    }
    if (spendMinor < 100) {
      validationError = 'Minimum amount is $1.00';
      return false;
    }
    if (spendMinor > availableMinor) {
      validationError = `Maximum available is ${formatUsdMinor(availableMinor)}`;
      return false;
    }
    validationError = '';
    return true;
  }

  function validateSellQuantity(): boolean {
    const quantity = Number.parseFloat(sellQuantity) || 0;
    if (!currentPosition) {
      validationError = 'No position available to exit';
      return false;
    }
    if (quantity <= 0) {
      validationError = 'Enter a quantity greater than zero';
      return false;
    }
    if (quantity > currentPosition.quantity) {
      validationError = `Maximum available is ${currentPosition.quantity.toFixed(2)} shares`;
      return false;
    }
    validationError = '';
    return true;
  }

  function updateBuyPreview() {
    const spendMinor = Number.parseInt(buySpend, 10) || 0;
    if (spendMinor < 100) {
      tradePreview = null;
      return;
    }
    const price = buySide === 'long' ? yesProbability : noProbability;
    const estimatedQuantity = (spendMinor / 100) / price;
    tradePreview = { quantity: estimatedQuantity };
  }

  function updateSellPreview() {
    const quantity = Number.parseFloat(sellQuantity) || 0;
    if (!currentPosition || quantity <= 0 || quantity > currentPosition.quantity) {
      tradePreview = null;
      return;
    }
    const price = currentPosition.side === 'long' ? yesProbability : noProbability;
    const estimatedAmount = Math.floor(quantity * price * 100);
    tradePreview = { amount: estimatedAmount };
  }

  async function applyRecoveredTradeProofs(
    receipt: ReturnType<typeof listTradeReceipts>[number],
    payload: ProductTradeExecution | ProductTradeStatus
  ) {
    const { issued, change } =
      'issued' in payload
        ? extractTradeBlindSignatureBundles(payload)
        : { issued: null, change: null };

    const issuedProofs = receipt.issuedPreparation
      ? issued
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.issuedPreparation, issued.signatures, {
            marketEventId: receipt.eventId
          })
        : await restorePreparedOutputs(proofMintUrl(), receipt.issuedPreparation, {
            marketEventId: receipt.eventId
          })
      : [];

    const changeProofs = receipt.changePreparation
      ? change
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.changePreparation, change.signatures, {
            marketEventId: receipt.eventId
          })
        : await restorePreparedOutputs(proofMintUrl(), receipt.changePreparation, {
            marketEventId: receipt.eventId
          })
      : [];

    if (!issuedProofs.length && !changeProofs.length) {
      throw new Error("We couldn't restore that trade on this device.");
    }

    if (receipt.spentUnit && receipt.spentProofs?.length) {
      removeLocalProofs(proofMintUrl(), receipt.spentUnit, receipt.spentProofs);
    }

    if (receipt.changePreparation && changeProofs.length) {
      addLocalProofs(proofMintUrl(), receipt.changePreparation.unit, changeProofs);
    }

    if (receipt.issuedPreparation && issuedProofs.length) {
      addLocalProofs(proofMintUrl(), receipt.issuedPreparation.unit, issuedProofs);
    }

    applyLocalPositionTradeFromPayload(proofMintUrl(), payload, receipt.action, receipt.side);

    refreshLocalWallet();
  }

  async function reconcileRecentTrades() {
    if (!currentUser) return;

    const receipts = listTradeReceipts(currentUser.pubkey, marketId).filter(
      (receipt) => receipt.action !== 'seed'
    );
    if (!receipts.length) return;
    let recoveredSide: 'long' | 'short' | null = null;
    setTradeState(TradePanelState.Recovering);

    for (const receipt of receipts) {
      try {
        if (receipt.tradeId) {
          const response = await fetchTradeStatus(receipt.tradeId);
          const payload = await parseJson<ProductTradeStatus>(
            response,
            'Failed to recover the latest trade status.'
          );
          if (!hasCompletedTradeSettlement(payload)) {
            setTradeStatus(
              TradePanelState.Pending,
              `Recovered pending settlement for ${receipt.action} on ${payload.market.slug}.`
            );
            continue;
          }
          await applyRecoveredTradeProofs(receipt, payload);
          clearTradeReceipt(receipt.id);
          recoveredSide = receipt.side;
          setTradeStatus(TradePanelState.Complete, `Recovered ${receipt.action} on ${payload.market.slug}.`);
          continue;
        }

        const response = await fetchTradeRequestStatus(receipt.id);
        if (!response.ok) {
          const quoteRecovery = await recoverTradeReceiptFromQuote(receipt);
          if (quoteRecovery === 'executed') {
            recoveredSide = receipt.side;
          }
          continue;
        }

        const payload = await parseJson<ProductTradeRequestStatus>(
          response,
          'Failed to recover the latest trade request.'
        );

        if (payload.status === 'pending') {
          setTradeStatus(
            TradePanelState.Pending,
            `Recovered pending ${receipt.action} on ${receipt.marketSlug}.`
          );
          continue;
        }

        if (payload.status === 'failed') {
          clearTradeReceipt(receipt.id);
          setTradeStatus(
            TradePanelState.Error,
            payload.error || `Recovered failed ${receipt.action} on ${receipt.marketSlug}.`
          );
          continue;
        }

        const tradeId = typeof payload.trade?.id === 'string' ? payload.trade.id : null;
        if (tradeId) {
          markTradeReceiptTradeId(receipt.id, tradeId);
          const tradeResponse = await fetchTradeStatus(tradeId);
          const tradePayload = await parseJson<ProductTradeStatus>(
            tradeResponse,
            'Failed to recover the completed trade status.'
          );
          if (!hasCompletedTradeSettlement(tradePayload)) {
            setTradeStatus(
              TradePanelState.Pending,
              `Recovered pending settlement for ${receipt.action} on ${receipt.marketSlug}.`
            );
            continue;
          }
          await applyRecoveredTradeProofs(receipt, tradePayload);
          clearTradeReceipt(receipt.id);
          recoveredSide = receipt.side;
          setTradeStatus(
            TradePanelState.Complete,
            `Recovered ${receipt.action} on ${tradePayload.market.slug}.`
          );
        }
      } catch {
        continue;
      }
    }

    await loadWallet();

    if (recoveredSide && currentPosition?.side === recoveredSide) {
      buySide = recoveredSide;
    }
  }

  async function recoverTradeReceiptFromQuote(
    receipt: ReturnType<typeof listTradeReceipts>[number]
  ): Promise<'executed' | 'handled' | null> {
    if (!receipt.quoteId) return null;

    const response = await fetchTradeQuoteStatus(receipt.quoteId);
    if (!response.ok) {
      clearTradeReceipt(receipt.id);
      return 'handled';
    }

    const payload = await parseJson<ProductTradeQuote>(
      response,
      'Failed to recover the locked trade quote.'
    );

    if (payload.status === 'executed' && payload.trade_id) {
      markTradeReceiptTradeId(receipt.id, payload.trade_id);
      const tradeResponse = await fetchTradeStatus(payload.trade_id);
      const tradePayload = await parseJson<ProductTradeStatus>(
        tradeResponse,
        'Failed to recover the completed trade status.'
      );
      if (!hasCompletedTradeSettlement(tradePayload)) {
        setTradeStatus(
          TradePanelState.Pending,
          `Recovered pending settlement for ${receipt.action} on ${receipt.marketSlug}.`
        );
        return 'handled';
      }
      await applyRecoveredTradeProofs(receipt, tradePayload);
      clearTradeReceipt(receipt.id);
      setTradeStatus(TradePanelState.Complete, `Recovered ${receipt.action} on ${tradePayload.market.slug}.`);
      return 'executed';
    }

    clearTradeReceipt(receipt.id);
    setTradeStatus(
      TradePanelState.Recovering,
      payload.status === 'expired'
        ? `Recovered expired ${receipt.action} quote on ${receipt.marketSlug}. Retry the trade.`
        : `Recovered open ${receipt.action} quote on ${receipt.marketSlug}. Retry the trade.`
    );
    return 'handled';
  }

  async function buy() {
    if (!currentUser) {
      setTradeError('Sign in before trading.');
      return;
    }

    if (!validateBuyAmount()) {
      return;
    }

    const spendMinor = Number.parseInt(buySpend, 10) || 0;

    setTradeStatus(
      TradePanelState.Quoting,
      `Buying ${buySide.toUpperCase()} with ${formatUsdMinor(spendMinor)}.`
    );
    clearTradeError();

    try {
      const quoteResponse = await quoteBuyTrade({
        eventId: marketId,
        side: buySide,
        spendMinor
      });
      const quote = await parseJson<ProductTradeQuote>(
        quoteResponse,
        'Failed to lock a buy quote.'
      );
      if (!quote.quote_id) {
        throw new Error('Buy quote is missing a quote id.');
      }
      const lockedQuoteId = quote.quote_id;
      setTradeState(TradePanelState.PreparingProofs);
      const spendProofs = selectLocalProofsForAmount(proofMintUrl(), 'usd', quote.spend_minor);
      if (!spendProofs.length) {
        throw new Error('Not enough funds available on this device to cover this trade.');
      }
      const tradeSide = normalizeProductTradeSide(quote.side, buySide);
      const marketUnit = marketUnitForSide(tradeSide);
      const { outputs: issuedOutputs, preparation: issuedPreparation } = await prepareProofOutputs(
        proofMintUrl(),
        marketUnit,
        quote.quantity_minor,
        undefined,
        { marketEventId: marketId }
      );
      const changeMinor = spendProofs.reduce((sum, proof) => sum + proof.amount, 0) - quote.spend_minor;
      const changePreparation =
        changeMinor > 0
          ? (
              await prepareProofOutputs(proofMintUrl(), 'usd', changeMinor)
            ).preparation
          : undefined;
      const changeOutputs =
        changeMinor > 0
          ? (await prepareProofOutputs(proofMintUrl(), 'usd', changeMinor, changePreparation)).outputs
          : [];

      const requestId = createTradeRequestId();
      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId: marketId,
        marketSlug,
        action: 'buy',
        side: tradeSide,
        spentUnit: 'usd',
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      setTradeState(TradePanelState.Submitting);
      const response = await buyMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: tradeSide,
        spendMinor: quote.spend_minor,
        proofs: spendProofs,
        issuedOutputs,
        changeOutputs,
        quoteId: lockedQuoteId,
        requestId
      });
      const payload = await parseJson<ProductTradeExecution>(response, 'Trade failed.');
      const tradeId = typeof payload.trade.id === 'string' ? payload.trade.id : null;
      if (tradeId) {
        markTradeReceiptTradeId(requestId, tradeId);
      } else {
        attachTradeReceiptQuoteId(requestId, lockedQuoteId);
      }

      setTradeState(TradePanelState.Finalizing);
      await applyRecoveredTradeProofs(
        {
          id: requestId,
          pubkey: currentUser.pubkey,
          eventId: marketId,
          marketSlug,
          action: 'buy',
          side: buySide,
          spentUnit: 'usd',
          spentProofs: spendProofs,
          issuedPreparation,
          changePreparation,
          createdAt: Date.now()
        },
        payload
      );

      if (hasCompletedTradeSettlement(payload)) {
        clearTradeReceipt(requestId);
        setTradeStatus(TradePanelState.Complete, `Bought ${buySide.toUpperCase()} on ${marketSlug}.`);
        tradeMode = 'exit';
      } else {
        setTradeStatus(TradePanelState.Pending, `Buy submitted on ${marketSlug}. Waiting for settlement.`);
      }
      tradePreview = null;
      await invalidateAll();
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Trade failed.', { clearStatus: true });
      tradePreview = null;
    }
  }

  async function sell() {
    if (!currentUser) {
      setTradeError('Sign in before trading.');
      return;
    }

    const sellSide = currentPosition?.side;
    if (!sellSide) {
      setTradeError('No current position is available to sell.');
      return;
    }

    if (!validateSellQuantity()) {
      return;
    }

    const quantity = Number.parseFloat(sellQuantity);

    setTradeStatus(
      TradePanelState.Quoting,
      `Selling ${quantity.toFixed(2)} ${sellSide.toUpperCase()} shares.`
    );
    clearTradeError();

    try {
      const quoteResponse = await quoteSellTrade({
        eventId: marketId,
        side: sellSide,
        quantity
      });
      const quote = await parseJson<ProductTradeQuote>(
        quoteResponse,
        'Failed to lock a sell quote.'
      );
      if (!quote.quote_id) {
        throw new Error('Sell quote is missing a quote id.');
      }
      const lockedQuoteId = quote.quote_id;
      const tradeSide = normalizeProductTradeSide(quote.side, sellSide);
      const marketUnit = marketUnitForSide(tradeSide);
      setTradeState(TradePanelState.PreparingProofs);
      const spendProofs = selectLocalProofsForAmount(
        proofMintUrl(),
        marketUnit,
        quote.quantity_minor
      );
      if (!spendProofs.length) {
        throw new Error(`Not enough ${sellSide.toUpperCase()} available on this device to sell.`);
      }
      const { outputs: issuedOutputs, preparation: issuedPreparation } =
        quote.net_minor > 0
          ? await prepareProofOutputs(proofMintUrl(), 'usd', quote.net_minor)
          : { outputs: [], preparation: undefined };
      const changeMinor =
        spendProofs.reduce((sum, proof) => sum + proof.amount, 0) - quote.quantity_minor;
      const changePreparation =
        changeMinor > 0
          ? (
              await prepareProofOutputs(proofMintUrl(), marketUnit, changeMinor, undefined, {
                marketEventId: marketId
              })
            ).preparation
          : undefined;
      const changeOutputs =
        changeMinor > 0
          ? (
              await prepareProofOutputs(proofMintUrl(), marketUnit, changeMinor, changePreparation, {
                marketEventId: marketId
              })
            ).outputs
          : [];

      const requestId = createTradeRequestId();
      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId: marketId,
        marketSlug,
        action: 'sell',
        side: tradeSide,
        spentUnit: marketUnit,
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      setTradeState(TradePanelState.Submitting);
      const response = await sellMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: tradeSide,
        quantity: quote.quantity,
        proofs: spendProofs,
        issuedOutputs,
        changeOutputs,
        quoteId: lockedQuoteId,
        requestId
      });
      const payload = await parseJson<ProductTradeExecution>(response, 'Sell failed.');
      const tradeId = typeof payload.trade.id === 'string' ? payload.trade.id : null;
      if (tradeId) {
        markTradeReceiptTradeId(requestId, tradeId);
      } else {
        attachTradeReceiptQuoteId(requestId, lockedQuoteId);
      }

      setTradeState(TradePanelState.Finalizing);
      await applyRecoveredTradeProofs(
        {
          id: requestId,
          pubkey: currentUser.pubkey,
          eventId: marketId,
          marketSlug,
          action: 'sell',
          side: sellSide,
          spentUnit: marketUnit,
          spentProofs: spendProofs,
          issuedPreparation,
          changePreparation,
          createdAt: Date.now()
        },
        payload
      );

      if (hasCompletedTradeSettlement(payload)) {
        clearTradeReceipt(requestId);
        setTradeStatus(TradePanelState.Complete, `Sold ${sellSide.toUpperCase()} on ${marketSlug}.`);
        if (quantity >= currentPosition.quantity) {
          tradeMode = 'mint';
        }
      } else {
        setTradeStatus(TradePanelState.Pending, `Sell submitted on ${marketSlug}. Waiting for settlement.`);
      }
      sellQuantity = '';
      tradePreview = null;
      await invalidateAll();
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Sell failed.', { clearStatus: true });
      tradePreview = null;
    }
  }

  $effect(() => {
    if (!browser || !currentUser) return;
    void (async () => {
      await loadWallet();
      await reconcileRecentTrades();
    })();
  });
</script>

<div class="grid gap-4" data-state={tradePanelState}>
  {#if currentUser}
    <div class="flex items-center justify-between text-sm">
      <span class="text-base-content/60">Available</span>
      <strong class="font-mono">{formatUsdMinor(availableMinor)}</strong>
    </div>
  {/if}

  <!-- Mode tabs -->
  <div role="tablist" class="tabs tabs-boxed">
    <button
      role="tab"
      class="tab"
      class:tab-active={tradeMode === 'mint'}
      onclick={() => { tradeMode = 'mint'; errorMessage = ''; validationError = ''; }}
    >
      Mint LONG/SHORT
    </button>
    <button
      role="tab"
      class="tab"
      class:tab-active={tradeMode === 'exit'}
      onclick={() => { tradeMode = 'exit'; errorMessage = ''; validationError = ''; }}
      disabled={!hasPosition}
    >
      Exit position
    </button>
  </div>

  {#if tradeMode === 'mint'}
    <div class="grid gap-4">
      <!-- Side selection -->
      <div class="grid gap-2">
        <span class="text-sm font-medium">Side</span>
        <div class="grid grid-cols-2 gap-3">
          <button
            class={buySide === 'long' ? 'btn btn-primary' : 'btn btn-outline'}
            type="button"
            onclick={() => { buySide = 'long'; updateBuyPreview(); }}
          >
            LONG {formatProbability(yesProbability)}
          </button>
          <button
            class={buySide === 'short' ? 'btn btn-error' : 'btn btn-outline'}
            type="button"
            onclick={() => { buySide = 'short'; updateBuyPreview(); }}
          >
            SHORT {formatProbability(noProbability)}
          </button>
        </div>
      </div>

      <!-- Amount input -->
      <div class="grid gap-1.5">
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-medium">Amount to spend</span>
          <span class="text-xs text-base-content/50">Max: {maxBuyAmount}</span>
        </div>
        <label class="form-control">
          <div class="join w-full">
            <span class="join-item btn btn-ghost btn-sm no-animation border border-base-300 px-3">$</span>
            <input
              class="input input-bordered join-item flex-1"
              bind:value={buySpend}
              oninput={() => { validationError = ''; updateBuyPreview(); }}
              placeholder="25.00"
              type="number"
              min="1"
              step="1"
              inputmode="decimal"
            />
            <span class="join-item btn btn-ghost btn-sm no-animation border border-base-300 px-3">USD</span>
          </div>
        </label>
        <span class="text-xs text-base-content/50">Minimum: $1.00 • Step: $1.00</span>

        {#if validationError}
          <p class="text-error text-sm">{validationError}</p>
        {/if}
        {#if tradePreview?.quantity}
          <div class="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            <span>↓</span>
            <span>You'll receive ~{tradePreview.quantity.toFixed(2)} shares</span>
          </div>
        {/if}

        {#if currentUser}
          <button class="btn btn-primary w-full" onclick={buy} disabled={!buySpendValid}>
            Mint {buySide === 'long' ? 'LONG' : 'SHORT'}
          </button>
        {:else}
          <a href="/join" class="btn btn-outline w-full">Sign in to trade →</a>
        {/if}

        {#if statusMessage}
          <p class="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{statusMessage}</p>
        {/if}
        {#if errorMessage}
          <p class="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{errorMessage}</p>
        {/if}
      </div>
    </div>
  {:else}
    <div class="grid gap-4">
      {#if hasPosition && currentPosition}
        <!-- Position summary -->
        <div class="rounded-md bg-base-300 p-3 grid gap-1.5">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium">Position</span>
            <strong class="font-mono text-sm">{currentPosition.quantity.toFixed(2)} {currentPosition.side === 'long' ? 'LONG' : 'SHORT'} shares</strong>
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-xs text-base-content/50">Current price</span>
            <span class="text-sm">{formatProbability(currentPosition.side === 'long' ? yesProbability : noProbability)}</span>
          </div>
        </div>

        <!-- Quantity input -->
        <div class="grid gap-1.5">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium">Quantity to exit</span>
            <button
              class="text-xs text-primary underline underline-offset-2 cursor-pointer bg-transparent border-none p-0"
              onclick={() => { if (currentPosition) { sellQuantity = currentPosition.quantity.toString(); updateSellPreview(); } }}
            >
              Exit all
            </button>
          </div>
          <label class="form-control">
            <div class="join w-full">
              <input
                class="input input-bordered join-item flex-1"
                bind:value={sellQuantity}
                oninput={() => { validationError = ''; updateSellPreview(); }}
                placeholder={currentPosition.quantity.toFixed(2)}
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
              />
              <span class="join-item btn btn-ghost btn-sm no-animation border border-base-300 px-3">shares</span>
            </div>
          </label>
          <span class="text-xs text-base-content/50">Max: {currentPosition.quantity.toFixed(2)} shares</span>

          {#if validationError}
            <p class="text-error text-sm">{validationError}</p>
          {/if}
          {#if tradePreview?.amount}
            <div class="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              <span>↓</span>
              <span>You'll receive ~{formatUsdMinor(tradePreview.amount)}</span>
            </div>
          {/if}

          {#if currentUser}
            <button class="btn btn-outline w-full" onclick={sell} disabled={!sellQuantityValid}>
              Exit {currentPosition.side === 'long' ? 'LONG' : 'SHORT'} position
            </button>
          {:else}
            <a href="/join" class="btn btn-outline w-full">Sign in to trade →</a>
          {/if}

          {#if statusMessage}
            <p class="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{statusMessage}</p>
          {/if}
          {#if errorMessage}
            <p class="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{errorMessage}</p>
          {/if}
        </div>
      {:else}
        <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">
          <p>No position yet. Mint LONG or SHORT to start trading.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>
