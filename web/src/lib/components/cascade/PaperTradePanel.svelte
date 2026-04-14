<script lang="ts">
  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
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
  import { getProductApiUrl } from '$lib/cascade/config';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { shareMinorToQuantity } from '$lib/cascade/shares';
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

  let availableMinor = $state(0);
  let buySide = $state<'long' | 'short'>('long');
  let buySpend = $state('2500');
  let sellQuantity = $state('');
  let status = $state('');
  let errorMessage = $state('');

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

  function proofMintUrl(): string {
    return getProductApiUrl().replace(/\/+$/, '');
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
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.issuedPreparation, issued.signatures)
        : await restorePreparedOutputs(proofMintUrl(), receipt.issuedPreparation)
      : [];

    const changeProofs = receipt.changePreparation
      ? change
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.changePreparation, change.signatures)
        : await restorePreparedOutputs(proofMintUrl(), receipt.changePreparation)
      : [];

    if (!issuedProofs.length && !changeProofs.length) {
      throw new Error('trade_proofs_missing');
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

    for (const receipt of receipts) {
      try {
        if (receipt.tradeId) {
          const response = await fetchTradeStatus(receipt.tradeId);
          const payload = await parseJson<ProductTradeStatus>(
            response,
            'Failed to recover the latest trade status.'
          );
          if (!hasCompletedTradeSettlement(payload)) {
            status = `Recovered pending settlement for ${receipt.action} on ${payload.market.slug}.`;
            continue;
          }
          await applyRecoveredTradeProofs(receipt, payload);
          clearTradeReceipt(receipt.id);
          recoveredSide = receipt.side;
          status = `Recovered ${receipt.action} on ${payload.market.slug}.`;
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
          status = `Recovered pending ${receipt.action} on ${receipt.marketSlug}.`;
          continue;
        }

        if (payload.status === 'failed') {
          clearTradeReceipt(receipt.id);
          status = payload.error || `Recovered failed ${receipt.action} on ${receipt.marketSlug}.`;
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
            status = `Recovered pending settlement for ${receipt.action} on ${receipt.marketSlug}.`;
            continue;
          }
          await applyRecoveredTradeProofs(receipt, tradePayload);
          clearTradeReceipt(receipt.id);
          recoveredSide = receipt.side;
          status = `Recovered ${receipt.action} on ${tradePayload.market.slug}.`;
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
        status = `Recovered pending settlement for ${receipt.action} on ${receipt.marketSlug}.`;
        return 'handled';
      }
      await applyRecoveredTradeProofs(receipt, tradePayload);
      clearTradeReceipt(receipt.id);
      status = `Recovered ${receipt.action} on ${tradePayload.market.slug}.`;
      return 'executed';
    }

    clearTradeReceipt(receipt.id);
    status =
      payload.status === 'expired'
        ? `Recovered expired ${receipt.action} quote on ${receipt.marketSlug}. Retry the trade.`
        : `Recovered open ${receipt.action} quote on ${receipt.marketSlug}. Retry the trade.`;
    return 'handled';
  }

  async function buy() {
    if (!currentUser) {
      errorMessage = 'Sign in before trading.';
      return;
    }

    const spendMinor = Number.parseInt(buySpend, 10) || 0;
    if (spendMinor <= 0) {
      errorMessage = 'Enter a buy amount greater than zero.';
      return;
    }

    status = `Buying ${buySide.toUpperCase()} with ${formatUsdMinor(spendMinor)}.`;
    errorMessage = '';

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
      const spendProofs = selectLocalProofsForAmount(proofMintUrl(), 'usd', quote.spend_minor);
      if (!spendProofs.length) {
        throw new Error('Not enough local USD funds to cover this trade.');
      }
      const marketUnit = marketUnitForSide((quote.side as 'long' | 'short') ?? buySide);
      const { outputs: issuedOutputs, preparation: issuedPreparation } = await prepareProofOutputs(
        proofMintUrl(),
        marketUnit,
        quote.quantity_minor
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
        side: buySide,
        spentUnit: 'usd',
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      const response = await buyMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: (quote.side as 'long' | 'short') ?? buySide,
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
        status = `Bought ${buySide.toUpperCase()} on ${marketSlug}.`;
      } else {
        status = `Buy submitted on ${marketSlug}. Waiting for settlement.`;
      }
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Trade failed.';
      status = '';
    }
  }

  async function sell() {
    if (!currentUser) {
      errorMessage = 'Sign in before trading.';
      return;
    }

    const sellSide = currentPosition?.side;
    if (!sellSide) {
      errorMessage = 'No current position is available to sell.';
      return;
    }

    const quantity = Number.parseFloat(sellQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errorMessage = 'Enter a sell quantity greater than zero.';
      return;
    }

    status = `Selling ${quantity.toFixed(2)} ${sellSide.toUpperCase()} shares.`;
    errorMessage = '';

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
      const marketUnit = marketUnitForSide((quote.side as 'long' | 'short') ?? sellSide);
      const spendProofs = selectLocalProofsForAmount(
        proofMintUrl(),
        marketUnit,
        quote.quantity_minor
      );
      if (!spendProofs.length) {
        throw new Error(`Not enough local ${sellSide.toUpperCase()} funds to sell.`);
      }
      const { outputs: issuedOutputs, preparation: issuedPreparation } = await prepareProofOutputs(
        proofMintUrl(),
        'usd',
        quote.net_minor
      );
      const changeMinor =
        spendProofs.reduce((sum, proof) => sum + proof.amount, 0) - quote.quantity_minor;
      const changePreparation =
        changeMinor > 0
          ? (await prepareProofOutputs(proofMintUrl(), marketUnit, changeMinor)).preparation
          : undefined;
      const changeOutputs =
        changeMinor > 0
          ? (await prepareProofOutputs(proofMintUrl(), marketUnit, changeMinor, changePreparation))
              .outputs
          : [];

      const requestId = createTradeRequestId();
      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId: marketId,
        marketSlug,
        action: 'sell',
        side: sellSide,
        spentUnit: marketUnit,
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      const response = await sellMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: (quote.side as 'long' | 'short') ?? sellSide,
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
        status = `Sold ${sellSide.toUpperCase()} on ${marketSlug}.`;
      } else {
        status = `Sell submitted on ${marketSlug}. Waiting for settlement.`;
      }
      sellQuantity = '';
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Sell failed.';
      status = '';
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

<aside class="trade-panel">
  <div class="trade-panel-head">
    <div>
      <h3>Practice trade</h3>
      <p>Trade with no real money. Test your conviction first.</p>
    </div>
  </div>

  {#if !currentUser}
    <p class="trade-muted">Sign in to buy or sell positions.</p>
  {:else}
    <div class="trade-balance">
      <span>Available</span>
      <strong>{formatUsdMinor(availableMinor)}</strong>
    </div>

    <div class="trade-field">
      <span>Side</span>
      <div class="trade-side-row">
        <button class:active={buySide === 'long'} type="button" onclick={() => (buySide = 'long')}>
          LONG {formatProbability(yesProbability)}
        </button>
        <button class:active={buySide === 'short'} type="button" onclick={() => (buySide = 'short')}>
          SHORT {formatProbability(noProbability)}
        </button>
      </div>
    </div>

    <div class="trade-field">
      <span>Amount</span>
      <input bind:value={buySpend} min="100" step="100" type="number" />
      <button class="button-primary" type="button" onclick={buy}>Buy {buySide === 'long' ? 'YES' : 'NO'}</button>
    </div>

    <div class="trade-field">
      <span>Current position</span>
      <strong>{currentPosition ? `${currentPosition.quantity.toFixed(2)} shares` : 'None yet'}</strong>
      <input bind:value={sellQuantity} min="0" step="0.1" type="number" />
      <button class="button-secondary" disabled={!currentPosition} type="button" onclick={sell}>
        Sell {currentPosition ? (currentPosition.side === 'long' ? 'LONG' : 'SHORT') : (buySide === 'long' ? 'LONG' : 'SHORT')}
      </button>
    </div>
  {/if}

  {#if status}
    <p class="trade-muted">{status}</p>
  {/if}
  {#if errorMessage}
    <p class="trade-error">{errorMessage}</p>
  {/if}
</aside>

<style>
  .trade-panel {
    display: grid;
    gap: 1rem;
    padding: 1rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .trade-panel-head,
  .trade-balance,
  .trade-field {
    display: grid;
    gap: 0.5rem;
  }

  .trade-panel h3,
  .trade-balance strong,
  .trade-field strong {
    color: white;
  }

  .trade-panel p,
  .trade-panel span {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .trade-side-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .trade-side-row button,
  .trade-field input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    background: transparent;
    color: white;
    padding: 0.85rem 0.95rem;
  }

  .trade-side-row button.active {
    border-color: white;
  }

  .trade-error {
    color: var(--color-error);
  }

  .trade-muted {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }
</style>
