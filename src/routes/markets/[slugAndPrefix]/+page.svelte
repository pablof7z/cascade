<script lang="ts">
  import NavHeader from '$lib/components/NavHeader.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { formatMarketSlug } from '$lib/marketSlug';
  import type { Market } from '$market';

  // Props from loader
  let { data } = $props();
  let market: Market = $derived(data.market);

  // Derived values
  let probability = $derived(
    market ? Math.round((market.qLong / (market.qLong + market.qShort)) * 100) : 50
  );
  let createdDate = $derived(
    market ? new Date(market.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : ''
  );
</script>

<div class="min-h-screen bg-neutral-950">
  <NavHeader />

  <main class="max-w-4xl mx-auto px-4 py-8">
    {#if !market}
      <div class="flex items-center justify-center py-32">
        <span class="text-neutral-500 text-sm">Market not found...</span>
      </div>
    {:else}
      <!-- Market Header -->
      <div class="mb-8">
        {#if market.image}
          <div class="mb-6 rounded-sm overflow-hidden">
            <img src={market.image} alt={market.title} class="w-full h-48 object-cover" />
          </div>
        {/if}

        <h1 class="text-2xl font-semibold text-white mb-4">{market.title}</h1>

        <div class="flex items-center gap-6 text-sm text-neutral-400 mb-6">
          <div class="flex items-center gap-2">
            <span class="text-neutral-500">Probability</span>
            <span class="font-mono text-white">{probability}%</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-neutral-500">Created</span>
            <span class="font-mono">{createdDate}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-neutral-500">Status</span>
            <span class="px-2 py-0.5 text-xs font-medium rounded-sm bg-neutral-800 text-neutral-300">
              {market.status}
            </span>
          </div>
        </div>

        {#if market.description}
          <p class="text-neutral-400 leading-relaxed mb-6">{market.description}</p>
        {/if}

        {#if market.thesis}
          <div class="border-t border-neutral-800 pt-6">
            <h2 class="text-sm font-medium text-neutral-300 mb-3">Thesis</h2>
            <p class="text-neutral-400 leading-relaxed mb-4">{market.thesis.statement}</p>
            {#if market.thesis.argument}
              <p class="text-neutral-500 text-sm leading-relaxed">{market.thesis.argument}</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-4 mb-8">
        <a
          href="/markets/{formatMarketSlug(market)}/trade"
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-sm transition-colors"
        >
          Trade
        </a>
        <a
          href="/markets/{formatMarketSlug(market)}/discussion"
          class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-sm transition-colors"
        >
          Discussion
        </a>
      </div>

      <!-- Market Stats -->
      <div class="border-t border-neutral-800 pt-8">
        <h2 class="text-sm font-medium text-neutral-300 mb-4">Market Stats</h2>
        <div class="grid grid-cols-3 gap-6">
          <div>
            <div class="text-xs text-neutral-500 mb-1">Long Position</div>
            <div class="font-mono text-lg text-white">{market.qLong.toFixed(4)}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500 mb-1">Short Position</div>
            <div class="font-mono text-lg text-white">{market.qShort.toFixed(4)}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500 mb-1">Reserve</div>
            <div class="font-mono text-lg text-white">{market.reserve.toFixed(2)} sats</div>
          </div>
        </div>
      </div>
    {/if}
  </main>

  <Footer />
</div>