<script lang="ts">
  import { onMount } from 'svelte'
  import { loadPositions, type Position } from '../../positionStore'
  import { load as loadMarkets } from '../../storage'
  import { priceLong, priceShort } from '../../market'
  import { fetchPayoutEvents, getPubkey, getNDK } from '../../services/nostrService'
  import { getRedemptionQuote, isPositionSettled } from '../../services/settlementService'
  import { redeemPosition as doRedemption, type RedemptionResult } from '../../services/redemptionService'
  import type { NDKEvent } from '@nostr-dev-kit/ndk'
  import type { Market } from '../../market'
  import type { MarketEntry } from '../../storage'
  import NavHeader from '$lib/components/NavHeader.svelte'

  // ─── State ────────────────────────────────────────────────────────────────────

  let activeTab = $state<'open' | 'settled'>('open')
  let positions = $state<Position[]>([])
  let markets = $state<Map<string, MarketEntry>>(new Map())
  let payoutEvents = $state<NDKEvent[]>([])
  let myPubkey = $state<string>('')
  // Redemption modal state
  let redeemModalOpen = $state(false)
  let redeemingPosition = $state<Position | null>(null)
  let redemptionQuote = $state<{ amount: number; fee: number } | null>(null)
  let redemptionAmount = $state<number | null>(null)
  let redemptionLoading = $state(false)
  let redemptionMessage = $state<string | null>(null)

  // ─── Derived ─────────────────────────────────────────────────────────────────

  // Enrich positions with market data
  let enrichedPositions = $derived(
    positions.map(pos => {
      const market = markets.get(pos.marketId)
      const longPrice = market ? priceLong(market) : 0
      const shortPrice = market ? priceShort(market) : 0
      const currentPrice = pos.direction === 'yes' ? longPrice : shortPrice
      const entryValue = pos.quantity * pos.entryPrice
      const currentValue = pos.quantity * currentPrice
      const pnl = currentValue - entryValue
      const pnlPercent = pos.entryPrice > 0 ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0

      return {
        ...pos,
        marketName: market?.title ?? 'Unknown Market',
        currentPrice,
        entryValue,
        currentValue,
        pnl,
        pnlPercent,
        isSettled: isPositionSettled(pos),
        canRedeem: canRedeemPosition(pos),
        isWon: market?.status === 'resolved' && (market.resolutionOutcome === 'YES' ? pos.direction === 'yes' : pos.direction === 'no'),
      }
    })
  )

  let unsettledPositions = $derived(enrichedPositions.filter(p => !p.isSettled && !p.isWon))
  let settledPositions = $derived(enrichedPositions.filter(p => p.isSettled || p.isWon))

  let totalValue = $derived(
    enrichedPositions.reduce((sum, p) => sum + p.currentValue, 0)
  )
  let totalPnL = $derived(
    enrichedPositions.reduce((sum, p) => sum + p.pnl, 0)
  )
  let unsettledValue = $derived(
    unsettledPositions.reduce((sum, p) => sum + p.currentValue, 0)
  )
  let totalPayouts = $derived(
    payoutEvents.reduce((sum, e) => {
      const amount = e.tagValue('amount')
      return sum + (amount ? parseInt(amount) : 0)
    }, 0)
  )

  // ─── Load data on mount ───────────────────────────────────────────────────────

  onMount(async () => {
    // Load positions
    positions = loadPositions()

    // Load markets for enrichment
    const marketsData = await loadMarkets()
    markets = new Map(marketsData.map(m => [m.market.slug, m]))

    // Fetch payout events
    myPubkey = getPubkey()
    if (myPubkey) {
      payoutEvents = await fetchPayoutEvents(myPubkey)
    }
  })

  // ─── Redemption handlers ──────────────────────────────────────────────────────

  async function handleRedeem(position: Position) {
    redeemingPosition = position
    redemptionQuote = null
    redemptionAmount = null
    redemptionMessage = null
    redeemModalOpen = true

    // Fetch quote
    redemptionLoading = true
    try {
      const quote = await getRedemptionQuote(position)
      redemptionQuote = quote
      redemptionAmount = quote.amount
    } catch (e) {
      redemptionMessage = 'Failed to get redemption quote'
    }
    redemptionLoading = false
  }

  async function confirmRedeem() {
    if (!redeemingPosition) return
    
    // Look up the market for this position
    const market = markets.get(redeemingPosition.marketId)
    if (!market) {
      redemptionMessage = 'Market not found for this position'
      redemptionLoading = false
      return
    }
    
    redemptionLoading = true
    redemptionMessage = null
    try {
      const ndk = getNDK()
      const result = await doRedemption(market.market, redeemingPosition, ndk)
      
      if (result.success) {
        redemptionMessage = `Redeemed! Received ${result.payout.netSats} sats.`
        // Refresh positions
        positions = loadPositions()
        setTimeout(() => {
          redeemModalOpen = false
          redeemingPosition = null
          redemptionAmount = null
          redemptionQuote = null
        }, 2000)
      } else {
        redemptionMessage = result.error.message
      }
    } catch (e) {
      redemptionMessage = 'Redemption failed'
    }
    redemptionLoading = false
  }

  function closeRedeemModal() {
    redeemModalOpen = false
    redeemingPosition = null
    redemptionQuote = null
    redemptionAmount = null
    redemptionMessage = null
  }

  function formatSats(amount: number) {
    return amount.toLocaleString('en-US')
  }

  function formatPercent(pct: number) {
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
  }
</script>

<svelte:head>
  <title>Portfolio | Cascade</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
  <NavHeader />

  <!-- Page header -->
  <div class="mb-6">
    <h1 class="text-lg font-semibold text-white">Your Portfolio</h1>
    <p class="mt-0.5 text-sm text-neutral-500">Track your positions and settlements</p>
  </div>

  {#if positions.length === 0}
    <div class="text-center py-12 border border-neutral-800">
      <p class="text-sm font-medium text-white">No positions yet</p>
      <p class="mt-1 text-xs text-neutral-500">Start trading on markets to see your positions here.</p>
    </div>
  {:else}
    <!-- Summary stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px border border-neutral-800 mb-6">
      <div class="bg-neutral-900 px-4 py-3">
        <p class="text-xs text-neutral-500 mb-1">Total Value</p>
        <p class="text-sm font-mono text-white">{formatSats(totalValue)} sats</p>
      </div>
      <div class="bg-neutral-900 px-4 py-3">
        <p class="text-xs text-neutral-500 mb-1">Total P&L</p>
        <p class="text-sm font-mono {totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          {totalPnL >= 0 ? '+' : ''}{formatSats(totalPnL)} sats
        </p>
      </div>
      <div class="bg-neutral-900 px-4 py-3">
        <p class="text-xs text-neutral-500 mb-1">Positions</p>
        <p class="text-sm font-mono text-white">{positions.length}</p>
      </div>
      <div class="bg-neutral-900 px-4 py-3">
        <p class="text-xs text-neutral-500 mb-1">Total Payouts</p>
        <p class="text-sm font-mono text-emerald-400">{formatSats(totalPayouts)} sats</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-neutral-800 mb-6">
      <button
        class="{activeTab === 'open' ? '-mb-px border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'} px-4 py-2 text-sm font-medium"
        onclick={() => activeTab = 'open'}>
        Open ({unsettledPositions.length})
      </button>
      <button
        class="{activeTab === 'settled' ? '-mb-px border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'} px-4 py-2 text-sm font-medium"
        onclick={() => activeTab = 'settled'}>
        Settled ({settledPositions.length})
      </button>
    </div>

    <!-- Open positions -->
    {#if activeTab === 'open'}
      {#if unsettledPositions.length === 0}
        <p class="text-sm text-neutral-500 py-8 text-center">No open positions</p>
      {:else}
        <table class="w-full">
          <thead>
            <tr class="border-b border-neutral-800 text-xs text-neutral-500">
              <th class="text-left px-4 py-2 font-medium">Market</th>
              <th class="text-right px-4 py-2 font-medium">Direction</th>
              <th class="text-right px-4 py-2 font-medium">Quantity</th>
              <th class="text-right px-4 py-2 font-medium">Entry</th>
              <th class="text-right px-4 py-2 font-medium">Current</th>
              <th class="text-right px-4 py-2 font-medium">Value</th>
              <th class="text-right px-4 py-2 font-medium">P&L</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800">
            {#each unsettledPositions as pos (pos.id)}
              <tr class="text-sm">
                <td class="px-4 py-3">
                  <a href="/mkt/{pos.marketId}" class="text-white hover:text-neutral-300">
                    {pos.marketName}
                  </a>
                </td>
                <td class="text-right px-4 py-3">
                  <span class="font-mono {pos.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}">
                    {pos.direction === 'yes' ? 'Long' : 'Short'}
                  </span>
                </td>
                <td class="text-right px-4 py-3 font-mono text-white">{formatSats(pos.quantity)}</td>
                <td class="text-right px-4 py-3 font-mono text-neutral-400">{formatSats(pos.entryPrice)}</td>
                <td class="text-right px-4 py-3 font-mono text-white">{formatSats(pos.currentPrice)}</td>
                <td class="text-right px-4 py-3 font-mono text-white">{formatSats(pos.currentValue)}</td>
                <td class="text-right px-4 py-3 font-mono {pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                  {formatSats(pos.pnl)}
                </td>
                <td class="px-4 py-3 text-right">
                  {#if pos.canRedeem}
                    <button
                      onclick={() => handleRedeem(pos)}
                      class="text-xs font-medium text-white border border-neutral-700 px-3 py-1 hover:border-neutral-500 transition-colors"
                    >
                      Redeem
                    </button>
                  {:else}
                    <span class="text-xs text-neutral-600">-</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}

    <!-- Settled positions -->
    {#if activeTab === 'settled'}
      {#if settledPositions.length === 0}
        <p class="text-sm text-neutral-500 py-8 text-center">No settled positions</p>
      {:else}
        <table class="w-full">
          <thead>
            <tr class="border-b border-neutral-800 text-xs text-neutral-500">
              <th class="text-left px-4 py-2 font-medium">Market</th>
              <th class="text-right px-4 py-2 font-medium">Direction</th>
              <th class="text-right px-4 py-2 font-medium">Quantity</th>
              <th class="text-right px-4 py-2 font-medium">Entry</th>
              <th class="text-right px-4 py-2 font-medium">Final</th>
              <th class="text-right px-4 py-2 font-medium">P&L</th>
              <th class="text-right px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800">
            {#each settledPositions as pos (pos.id)}
              <tr class="text-sm opacity-60">
                <td class="px-4 py-3 text-neutral-400">{pos.marketName}</td>
                <td class="text-right px-4 py-3">
                  <span class="font-mono {pos.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}">
                    {pos.direction === 'yes' ? 'Long' : 'Short'}
                  </span>
                </td>
                <td class="text-right px-4 py-3 font-mono text-neutral-400">{formatSats(pos.quantity)}</td>
                <td class="text-right px-4 py-3 font-mono text-neutral-400">{formatSats(pos.entryPrice)}</td>
                <td class="text-right px-4 py-3 font-mono text-white">{formatSats(pos.currentPrice)}</td>
                <td class="text-right px-4 py-3 font-mono {pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                  {formatSats(pos.pnl)}
                </td>
                <td class="text-right px-4 py-3">
                  <span class="text-xs text-emerald-400">
                    {pos.isWon ? 'Won' : 'Lost'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  {/if}
</div>

<!-- Redemption Modal -->
{#if redeemModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <button
      class="absolute inset-0 bg-black/70 cursor-default"
      onclick={closeRedeemModal}
      aria-label="Close modal"
    ></button>

    <!-- Modal -->
    <div class="relative bg-neutral-900 border border-neutral-700 p-6 w-full max-w-md mx-4">
      <h2 class="text-base font-semibold text-white mb-4">Redeem Position</h2>

      {#if redeemingPosition}
        <div class="mb-4">
          <p class="text-sm text-neutral-400 mb-1">Market</p>
          <p class="text-white">{redeemingPosition.marketName}</p>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-xs text-neutral-500 mb-1">Direction</p>
            <p class="text-sm {redeemingPosition.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}">
              {redeemingPosition.direction === 'yes' ? 'Long' : 'Short'}
            </p>
          </div>
          <div>
            <p class="text-xs text-neutral-500 mb-1">Quantity</p>
            <p class="text-sm font-mono text-white">{formatSats(redeemingPosition.quantity)}</p>
          </div>
        </div>
      {/if}

      {#if redemptionLoading}
        <p class="text-sm text-neutral-500">Getting quote...</p>
      {:else if redemptionQuote}
        <div class="border border-neutral-700 p-3 mb-4">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-neutral-500">You receive</span>
            <span class="font-mono text-emerald-400">{formatSats(redemptionQuote.amount)} sats</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-neutral-600">Fee</span>
            <span class="font-mono text-neutral-500">{formatSats(redemptionQuote.fee)} sats</span>
          </div>
        </div>
      {/if}

      {#if redemptionMessage}
        <p class="text-sm mb-4 {redemptionMessage.includes('!') ? 'text-emerald-400' : 'text-rose-400'}">
          {redemptionMessage}
        </p>
      {/if}

      <div class="flex gap-3">
        <button
          onclick={closeRedeemModal}
          class="flex-1 text-sm font-medium text-neutral-400 border border-neutral-700 px-4 py-2 hover:border-neutral-500 transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={confirmRedeem}
          disabled={redemptionLoading || !redemptionQuote}
          class="flex-1 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 transition-colors"
        >
          {redemptionLoading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}
