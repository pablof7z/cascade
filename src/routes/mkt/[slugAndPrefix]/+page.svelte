<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { formatMarketSlug } from '$lib/marketSlug';
  import { priceLong, priceShort } from '../../../market';
  import { executeTrade } from '../../../services/tradingService';
  import { getDisplayName } from '../../../services/nostrService';
  import { getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import MarketDiscussionList from '$lib/components/discussion/MarketDiscussionList.svelte';
  import NavHeader from '$lib/components/NavHeader.svelte';
  
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
  let tradeLoading = $state(false);
  let tradeError = $state<string | null>(null);
  let tradeSuccess = $state(false);
  let isBookmarked = $state(false);
  let creatorDisplayName = $state<string>('Anonymous');

  // Resolve creator display name
  $effect(() => {
    const pubkey = market?.creatorPubkey;
    if (!pubkey) return;
    getDisplayName(pubkey).then((name) => {
      creatorDisplayName = name;
    });
  });
  
  // Auth state
  let isLoggedIn = $derived(getCurrentPubkey() !== null);

  // Price calculations (LMSR)
  let yesPrice = $derived(market ? priceLong(market.qLong, market.qShort, market.b) : 0);
  let noPrice = $derived(market ? priceShort(market.qLong, market.qShort, market.b) : 0);
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

  function handleBookmark() {
    isBookmarked = !isBookmarked;
  }

  async function handleTrade() {
    if (!market) return;

    tradeLoading = true;
    tradeError = null;
    tradeSuccess = false;

    const result = await executeTrade(market, selectedSide, amount);

    tradeLoading = false;

    if (!result.success) {
      switch (result.error.kind) {
        case 'insufficient_balance':
          tradeError = `Insufficient balance. You have ${result.error.balance} sats, need ${result.error.required} sats.`;
          break;
        case 'wallet_unavailable':
          tradeError = 'Wallet unavailable. Please set up your wallet to trade.';
          break;
        case 'mint_unavailable':
          tradeError = 'Mint unavailable. Please try again shortly.';
          break;
        case 'invalid_amount':
          tradeError = 'Invalid amount. Enter a positive number.';
          break;
        case 'send_failed':
          tradeError = `Trade failed: ${result.error.reason}`;
          break;
        default:
          tradeError = 'Trade failed. Please try again.';
      }
    } else {
      tradeError = null;
      tradeSuccess = true;
    }
  }
  
  // Get slugAndPrefix for nested links
  let slugAndPrefix = $derived(market ? formatMarketSlug(market as any) : '');
</script>

<svelte:head>
  {#if market}
    {@const pct = Math.round(probability * 100)}
    <title>{market.title} — {pct}% YES | Cascade</title>
    <meta name="description" content="{market.description?.slice(0, 140) || 'Market on Cascade'}. Currently {pct}% probability." />
    <meta property="og:title" content="{market.title} — {pct}% YES" />
    <meta property="og:description" content="{market.description?.slice(0, 200) || 'Prediction market on Cascade'}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://cascade.markets/mkt/{slugAndPrefix}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@cascademarkets" />
    <meta name="twitter:title" content="{market.title} — {pct}% YES" />
    <meta name="twitter:description" content="{market.description?.slice(0, 200) || 'Prediction market on Cascade'}" />
  {/if}
</svelte:head>

{#if !market}
  <div class="min-h-screen bg-neutral-950">
    <NavHeader />
    <div class="flex items-center justify-center" style="height: calc(100vh - 57px);">
      <span class="text-neutral-500 text-sm">Market not found...</span>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-neutral-950">
    <NavHeader />
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
                by {creatorDisplayName}
              </button>
              <span class="mx-2">·</span>
              Created {new Date(market.createdAt * 1000).toLocaleDateString()}
            </p>
          </div>
          <div>
            <BookmarkButton
              {isBookmarked}
              onToggle={handleBookmark}
              size="sm"
            />
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
        <!-- Probability -->
        <div class="py-6 border-b border-neutral-800">
          <div class="flex items-end gap-3">
            <span class="text-4xl font-mono font-bold text-white">{Math.round(probability * 100)}%</span>
            <span class="text-sm text-neutral-500 mb-1">YES probability</span>
          </div>
          <div class="text-sm text-neutral-500 mt-1">{Math.round((1 - probability) * 100)}% NO</div>
        </div>
        
        <!-- Trade -->
        <div class="py-6 border-b border-neutral-800">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Trade</h2>
          <div class="flex gap-2 mb-4">
            <button
              onclick={() => selectedSide = 'LONG'}
              class="flex-1 px-4 py-2 text-sm font-medium transition-colors border"
              class:border-emerald-500={selectedSide === 'LONG'}
              class:text-emerald-400={selectedSide === 'LONG'}
              class:border-neutral-700={selectedSide !== 'LONG'}
              class:text-neutral-500={selectedSide !== 'LONG'}
              class:hover:text-neutral-300={selectedSide !== 'LONG'}
            >
              YES
            </button>
            <button
              onclick={() => selectedSide = 'SHORT'}
              class="flex-1 px-4 py-2 text-sm font-medium transition-colors border"
              class:border-rose-500={selectedSide === 'SHORT'}
              class:text-rose-400={selectedSide === 'SHORT'}
              class:border-neutral-700={selectedSide !== 'SHORT'}
              class:text-neutral-500={selectedSide !== 'SHORT'}
              class:hover:text-neutral-300={selectedSide !== 'SHORT'}
            >
              NO
            </button>
          </div>
          
          <div class="mb-4">
            <label for="amount" class="block text-xs text-neutral-500 mb-2">Amount (sats)</label>
            <input
              id="amount"
              type="number"
              bind:value={amount}
              class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-neutral-600"
              min="10"
              step="10"
            />
          </div>
          
          <div class="flex items-center justify-between text-sm mb-4">
            <span class="text-neutral-500">Price per share</span>
            <span class="font-mono text-white">
              {formatCurrency(selectedSide === 'LONG' ? yesPrice : noPrice)}
            </span>
          </div>
          
          {#if tradeError}
            <div class="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-sm text-rose-400">
              {tradeError}
            </div>
          {/if}
          
          <button
            onclick={handleTrade}
            disabled={tradeLoading || amount <= 0 || !isLoggedIn}
            class="w-full py-3 text-sm font-medium transition-colors border disabled:border-neutral-700 disabled:text-neutral-500"
            class:border-emerald-600={selectedSide === 'LONG' && !tradeLoading && isLoggedIn}
            class:text-emerald-400={selectedSide === 'LONG' && !tradeLoading && isLoggedIn}
            class:hover:border-emerald-500={selectedSide === 'LONG' && !tradeLoading && isLoggedIn}
            class:border-rose-600={selectedSide === 'SHORT' && !tradeLoading && isLoggedIn}
            class:text-rose-400={selectedSide === 'SHORT' && !tradeLoading && isLoggedIn}
            class:hover:border-rose-500={selectedSide === 'SHORT' && !tradeLoading && isLoggedIn}
          >
            {#if tradeLoading}
              Processing...
            {:else}
              Buy {selectedSide === 'LONG' ? 'YES' : 'NO'} Shares · {amount} sats
            {/if}
          </button>

          {#if !isLoggedIn}
            <p class="mt-3 text-sm text-neutral-400">
              <a href="/join" class="text-white underline">Sign in</a> to trade
            </p>
          {/if}
        </div>
        
        <!-- Description -->
        <div class="py-6">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Description</h2>
          <p class="text-neutral-300 leading-relaxed">
            {market.description || 'No description provided.'}
          </p>
        </div>
      {:else if activeTab === 'discussion'}
        <MarketDiscussionList market={market} />
      {:else if activeTab === 'positions'}
        <div class="text-center py-12">
          <p class="text-neutral-500 text-sm">No positions yet</p>
        </div>
      {:else if activeTab === 'charts'}
        <div class="text-center py-12">
          <p class="text-neutral-500 text-sm">Charts coming soon</p>
        </div>
      {/if}
    </div>
  </div>
{/if}
