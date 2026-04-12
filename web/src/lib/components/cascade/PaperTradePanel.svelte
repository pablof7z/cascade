<script lang="ts">
  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
  import {
    buyMarketPosition,
    expectOk,
    fetchPaperWallet,
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
    type ProductTradeStatus,
    type ProductWallet
  } from '$lib/cascade/api';
  import { formatUsdMinor } from '$lib/cascade/format';
  import {
    attachTradeReceiptQuoteId,
    clearTradeReceipt,
    listTradeReceipts,
    markTradeReceiptTradeId,
    trackTradeReceipt
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { formatProbability } from '$lib/ndk/cascade';

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

  type WalletPosition = ProductWallet['positions'][number];

  type PaperWallet = Pick<ProductWallet, 'available_minor' | 'positions'>;

  const currentUser = $derived(ndk.$currentUser);

  let wallet = $state<PaperWallet | null>(null);
  let buySide = $state<'yes' | 'no'>('yes');
  let buySpend = $state('2500');
  let sellQuantity = $state('');
  let status = $state('');
  let errorMessage = $state('');

  const currentPosition = $derived.by(() => {
    if (!wallet) return null;
    return (
      wallet.positions.find(
        (position) => position.market_event_id === marketId && position.direction === buySide
      ) ??
      wallet.positions.find((position) => position.market_event_id === marketId) ??
      null
    );
  });

  function alignSideToWallet(nextWallet: PaperWallet) {
    const ownedPosition = nextWallet.positions.find((position) => position.market_event_id === marketId);
    if (!ownedPosition) return;

    const normalizedDirection = ownedPosition.direction.toLowerCase() === 'no' ? 'no' : 'yes';
    const hasCurrentSidePosition = nextWallet.positions.some(
      (position) =>
        position.market_event_id === marketId && position.direction.toLowerCase() === buySide
    );

    if (!hasCurrentSidePosition) {
      buySide = normalizedDirection;
    }
  }

  function createTradeRequestId(): string {
    if (browser && typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${marketId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  async function loadWallet() {
    if (!currentUser) return;
    const response = await fetchPaperWallet(currentUser.pubkey);
    if (!response.ok) return;
    const nextWallet = (await response.json()) as PaperWallet;
    alignSideToWallet(nextWallet);
    wallet = nextWallet;
  }

  async function reconcileRecentTrades() {
    if (!currentUser) return;

    const receipts = listTradeReceipts(currentUser.pubkey, marketId).filter(
      (receipt) => receipt.action !== 'seed'
    );
    if (!receipts.length) return;
    let recoveredSide: 'yes' | 'no' | null = null;

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
          clearTradeReceipt(receipt.id);
          recoveredSide = receipt.side;
          status = `Recovered ${receipt.action} on ${tradePayload.market.slug}.`;
        }
      } catch {
        continue;
      }
    }

    await loadWallet();

    if (recoveredSide && wallet) {
      const hasRecoveredSidePosition = wallet.positions.some(
        (position) =>
          position.market_event_id === marketId &&
          position.direction.toLowerCase() === recoveredSide
      );

      if (hasRecoveredSidePosition) {
        buySide = recoveredSide;
      }
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

      const requestId = createTradeRequestId();
      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId: marketId,
        marketSlug,
        action: 'buy',
        side: buySide
      });

      const response = await buyMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: (quote.side as 'yes' | 'no') ?? buySide,
        spendMinor: quote.spend_minor,
        quoteId: lockedQuoteId,
        requestId
      });
      await expectOk(response, 'Trade failed.');
      const payload = (await response.json()) as ProductTradeExecution;
      const tradeId = typeof payload.trade.id === 'string' ? payload.trade.id : null;
      if (tradeId) {
        markTradeReceiptTradeId(requestId, tradeId);
      } else {
        attachTradeReceiptQuoteId(requestId, lockedQuoteId);
      }

      if (hasCompletedTradeSettlement(payload)) {
        clearTradeReceipt(requestId);
        status = `Bought ${buySide.toUpperCase()} on ${marketSlug}.`;
      } else {
        status = `Buy submitted on ${marketSlug}. Waiting for settlement.`;
      }
      alignSideToWallet(payload.wallet);
      wallet = payload.wallet;
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

    const quantity = Number.parseFloat(sellQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errorMessage = 'Enter a sell quantity greater than zero.';
      return;
    }

    status = `Withdrawing ${quantity.toFixed(2)} ${buySide.toUpperCase()} shares.`;
    errorMessage = '';

    try {
      const quoteResponse = await quoteSellTrade({
        eventId: marketId,
        side: buySide,
        quantity
      });
      const quote = await parseJson<ProductTradeQuote>(
        quoteResponse,
        'Failed to lock a withdrawal quote.'
      );
      if (!quote.quote_id) {
        throw new Error('Sell quote is missing a quote id.');
      }
      const lockedQuoteId = quote.quote_id;

      const requestId = createTradeRequestId();
      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId: marketId,
        marketSlug,
        action: 'sell',
        side: buySide
      });

      const response = await sellMarketPosition({
        eventId: marketId,
        pubkey: currentUser.pubkey,
        side: (quote.side as 'yes' | 'no') ?? buySide,
        quantity: quote.quantity,
        quoteId: lockedQuoteId,
        requestId
      });
      await expectOk(response, 'Sell failed.');
      const payload = (await response.json()) as ProductTradeExecution;
      const tradeId = typeof payload.trade.id === 'string' ? payload.trade.id : null;
      if (tradeId) {
        markTradeReceiptTradeId(requestId, tradeId);
      } else {
        attachTradeReceiptQuoteId(requestId, lockedQuoteId);
      }

      if (hasCompletedTradeSettlement(payload)) {
        clearTradeReceipt(requestId);
        status = `Withdrew ${buySide.toUpperCase()} on ${marketSlug}.`;
      } else {
        status = `Withdrawal submitted on ${marketSlug}. Waiting for settlement.`;
      }
      sellQuantity = '';
      alignSideToWallet(payload.wallet);
      wallet = payload.wallet;
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
      <h3>Paper trade</h3>
      <p>Trade this market from your signet wallet.</p>
    </div>
  </div>

  {#if !currentUser}
    <p class="trade-muted">Sign in to buy or withdraw positions.</p>
  {:else}
    <div class="trade-balance">
      <span>Available</span>
      <strong>{formatUsdMinor(wallet?.available_minor ?? 0)}</strong>
    </div>

    <div class="trade-field">
      <span>Side</span>
      <div class="trade-side-row">
        <button class:active={buySide === 'yes'} type="button" onclick={() => (buySide = 'yes')}>
          YES {formatProbability(yesProbability)}
        </button>
        <button class:active={buySide === 'no'} type="button" onclick={() => (buySide = 'no')}>
          NO {formatProbability(noProbability)}
        </button>
      </div>
    </div>

    <div class="trade-field">
      <span>Buy spend</span>
      <input bind:value={buySpend} min="100" step="100" type="number" />
      <button class="button-primary" type="button" onclick={buy}>Buy {buySide.toUpperCase()}</button>
    </div>

    <div class="trade-field">
      <span>Current position</span>
      <strong>{currentPosition ? `${currentPosition.quantity.toFixed(2)} shares` : 'None yet'}</strong>
      <input bind:value={sellQuantity} min="0" step="0.1" type="number" />
      <button class="button-secondary" disabled={!currentPosition} type="button" onclick={sell}>
        Withdraw {buySide.toUpperCase()}
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
    border-top: 1px solid var(--border-subtle);
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
    color: var(--text-strong);
  }

  .trade-panel p,
  .trade-panel span {
    color: var(--text-muted);
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
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-strong);
    padding: 0.85rem 0.95rem;
  }

  .trade-side-row button.active {
    border-color: var(--text-strong);
  }

  .trade-error {
    color: var(--negative);
  }

  .trade-muted {
    color: var(--text-muted);
  }
</style>
