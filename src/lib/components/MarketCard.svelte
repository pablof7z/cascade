<script lang="ts">
  import type { Market } from '../../market';
  import Sparkline from './Sparkline.svelte';

  interface Props {
    market: Market;
    showButtons?: boolean;
    onBuy?: (side: 'LONG' | 'SHORT') => void;
  }

  let { market, showButtons = true, onBuy }: Props = $props();

  // ─── Derived data ─────────────────────────────────────────────────────────────

  // Price calculations (LMSR)
  let yesPrice = $derived(market.qLong / (market.qLong + market.qShort + market.b));
  let noPrice = $derived(market.qShort / (market.qLong + market.qShort + market.b));

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function formatPrice(value: number): string {
    return `${(value * 100).toFixed(0)}¢`;
  }

  function handleBuy(side: 'LONG' | 'SHORT') {
    onBuy?.(side);
  }

  function navigateToMarket() {
    const pubkeyPrefix = market.creatorPubkey.slice(0, 12);
    window.location.href = `/mkt/${market.slug}--${pubkeyPrefix}`;
  }
</script>

<!-- Market Card -->
<div class="bg-neutral-950 border border-neutral-800 p-4 hover:border-neutral-700 transition-colors">
  <!-- Header: Title + Price -->
  <div class="flex items-start justify-between gap-3">
    <button
      onclick={navigateToMarket}
      class="flex-1 text-left group"
    >
      <h3 class="text-white font-medium group-hover:text-emerald-400 transition-colors line-clamp-2">
        {market.title}
      </h3>
      <p class="mt-1 text-xs text-neutral-500">
        {new Date(market.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        {#if market.status === 'resolved'}
          <span class="ml-2 text-rose-400">RESOLVED</span>
        {/if}
      </p>
    </button>

    <!-- Current Price -->
    <div class="text-right shrink-0">
      <div class="text-lg font-semibold text-white">
        {formatPrice(yesPrice)}
      </div>

    </div>
  </div>

  <!-- Probability Bar -->
  <div class="mt-4">
    <div class="h-1.5 bg-neutral-900 rounded-none overflow-hidden">
      <div
        class="h-full bg-emerald-500 transition-all"
        style="width: {yesPrice * 100}%"
      ></div>
    </div>
    <div class="mt-1.5 flex justify-between text-xs">
      <span class="text-emerald-400">YES {formatPrice(yesPrice)}</span>
      <span class="text-rose-400">NO {formatPrice(noPrice)}</span>
    </div>
  </div>

  <!-- Sparkline -->
  <div class="mt-3 overflow-hidden">
    <Sparkline slug={market.slug} height={40} />
  </div>

  <!-- Trading Buttons -->
  {#if showButtons}
    <div class="mt-4 grid grid-cols-2 gap-2">
      <button
        onclick={() => handleBuy('LONG')}
        class="px-3 py-2 text-sm font-medium bg-neutral-800 hover:bg-emerald-900/30 border border-neutral-700 hover:border-emerald-600 text-white transition-colors"
      >
        Buy YES
      </button>
      <button
        onclick={() => handleBuy('SHORT')}
        class="px-3 py-2 text-sm font-medium bg-neutral-800 hover:bg-rose-900/30 border border-neutral-700 hover:border-rose-600 text-white transition-colors"
      >
        Buy NO
      </button>
    </div>
  {/if}
</div>