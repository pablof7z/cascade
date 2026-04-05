<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { formatMarketSlug } from '$lib/marketSlug';
  
  // Reuse types and structure from the main market page
  type MarketTab = 'overview' | 'charts' | 'discussion' | 'positions';
  type Side = 'LONG' | 'SHORT';
  
  // Props from loader
  let { data } = $props();
  
  // Market data
  let market = $derived(data.market);
  
  // State
  let activeTab = $state<MarketTab>('overview');
  let selectedSide = $state<Side>('LONG');
  let amount = $state(100);
  
  // Price calculations (simplified LMSR)
  let yesPrice = $derived(market ? market.qLong / (market.qLong + market.qShort + market.b) : 0);
  let noPrice = $derived(market ? market.qShort / (market.qLong + market.qShort + market.b) : 0);
  let probability = $derived(yesPrice);
  
  // Format helpers
  function formatCurrency(value: number) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }
  
  // Tab definitions
  const tabs: { key: MarketTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'charts', label: 'Charts' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'positions', label: 'Positions' },
  ];
  
  function setTab(tab: MarketTab) {
    activeTab = tab;
  }
  
  function navigateToDiscussion() {
    if (!market) return;
    goto(`/thread/${market.slug}`);
  }
  
  function navigateToProfile(pubkey: string) {
    goto(`/profile/${pubkey}/portfolio`);
  }
  
  // Get slugAndPrefix for nested links
  let slugAndPrefix = $derived(market ? formatMarketSlug(market as any) : '');
</script>

<svelte:head>
  {#if market}
    {@const pct = Math.round(probability * 100)}
    <title>{market.title} — {pct}% YES | Cascade</title>
    <meta name="description" content="{market.description?.slice(0, 140) || 'Market on Cascade'}. Currently {pct}% probability." />
  {/if}
</svelte:head>

{#if !market}
  <div class="min-h-screen bg-neutral-950 flex items-center justify-center">
    <span class="text-neutral-500 text-sm">Market not found...</span>
  </div>
{:else}
  <div class="min-h-screen bg-neutral-950">
    <!-- Header -->
    <div class="border-b border-neutral-800">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h1 class="text-xl font-semibold text-white truncate">{market.title}</h1>
            <p class="text-sm text-neutral-500 mt-1">
              <button 
                onclick={() => navigateToProfile(market.creatorPubkey)}
                class="hover:text-neutral-300"
              >
                by {market.creatorPubkey?.slice(0, 8)}...
              </button>
              <span class="mx-2">·</span>
              Created {new Date(market.createdAt * 1000).toLocaleDateString()}
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-mono font-semibold" class:text-emerald-400={probability >= 0.5} class:text-rose-400={probability < 0.5}>
              {Math.round(probability * 100)}%
            </div>
            <div class="text-xs text-neutral-500">YES probability</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="border-b border-neutral-800">
      <div class="max-w-4xl mx-auto px-4">
        <nav class="flex gap-1">
          {#each tabs as tab}
            <button
              onclick={() => setTab(tab.key)}
              class="px-4 py-3 text-sm font-medium transition-colors relative"
              class:text-white={activeTab === tab.key}
              class:text-neutral-500={activeTab !== tab.key}
              class:hover:text-neutral-300={activeTab !== tab.key}
            >
              {tab.label}
              {#if activeTab === tab.key}
                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
              {/if}
            </button>
          {/each}
        </nav>
      </div>
    </div>
    
    <!-- Content -->
    <div class="max-w-4xl mx-auto px-4 py-6">
      {#if activeTab === 'overview'}
        <!-- Market Info -->
        <div class="space-y-6">
          <!-- Probability Card -->
          <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h2 class="text-sm font-medium text-neutral-400 mb-4">Current Probability</h2>
            <div class="flex items-end gap-4">
              <div class="text-4xl font-mono font-bold text-white">
                {Math.round(probability * 100)}%
              </div>
              <div class="text-sm text-neutral-500 mb-1">YES</div>
            </div>
            <div class="mt-4 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                class="h-full bg-emerald-500 transition-all"
                style="width: {probability * 100}%"
              ></div>
            </div>
          </div>
          
          <!-- Trading Section -->
          <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h2 class="text-sm font-medium text-neutral-400 mb-4">Trade</h2>
            <div class="flex gap-2 mb-4">
              <button
                onclick={() => selectedSide = 'LONG'}
                class="flex-1 py-2 text-sm font-medium rounded transition-colors"
                class:bg-emerald-600={selectedSide === 'LONG'}
                class:text-white={selectedSide === 'LONG'}
                class:bg-neutral-800={selectedSide !== 'LONG'}
                class:text-neutral-400={selectedSide !== 'LONG'}
              >
                YES ({formatPercent(yesPrice)})
              </button>
              <button
                onclick={() => selectedSide = 'SHORT'}
                class="flex-1 py-2 text-sm font-medium rounded transition-colors"
                class:bg-rose-600={selectedSide === 'SHORT'}
                class:text-white={selectedSide === 'SHORT'}
                class:bg-neutral-800={selectedSide !== 'SHORT'}
                class:text-neutral-400={selectedSide !== 'SHORT'}
              >
                NO ({formatPercent(noPrice)})
              </button>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="number"
                bind:value={amount}
                class="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 rounded"
                placeholder="Amount in sats"
              />
              <button class="px-4 py-2 bg-white text-neutral-950 text-sm font-medium rounded hover:bg-neutral-200 transition-colors">
                Buy {selectedSide}
              </button>
            </div>
          </div>
          
          <!-- Description -->
          {#if market.description}
            <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
              <h2 class="text-sm font-medium text-neutral-400 mb-3">Description</h2>
              <p class="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
                {market.description}
              </p>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'charts'}
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Price Chart</h2>
          <div class="h-64 flex items-center justify-center text-neutral-500 text-sm">
            Charts coming soon
          </div>
        </div>
      {:else if activeTab === 'discussion'}
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-neutral-400">Discussion</h2>
            <button 
              onclick={navigateToDiscussion}
              class="text-sm text-white hover:text-neutral-300"
            >
              View all →
            </button>
          </div>
          <div class="text-neutral-500 text-sm">
            <button 
              onclick={navigateToDiscussion}
              class="w-full py-8 text-center hover:bg-neutral-800 rounded transition-colors"
            >
              Join the discussion →
            </button>
          </div>
        </div>
      {:else if activeTab === 'positions'}
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Your Positions</h2>
          <div class="text-center py-8 text-neutral-500 text-sm">
            No positions yet
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
