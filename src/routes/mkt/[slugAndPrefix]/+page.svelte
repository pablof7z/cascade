<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { formatMarketSlug } from '$lib/marketSlug';
  import { priceLong, priceShort } from '../../../market';
  import { executeTrade } from '../../../services/tradingService';
  import { getDisplayName, getNDK, fetchEvents } from '../../../services/nostrService';
  import { fetchAllPositions } from '../../../services/positionService';
  import type { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';
  import type { Position } from '../../../positionStore';
  import { getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import { getBalance } from '$lib/stores/wallet.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import MarketDiscussionList from '$lib/components/discussion/MarketDiscussionList.svelte';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import PriceChart from '$lib/components/PriceChart.svelte';
  
  // Reuse types and structure from the main market page
  type MarketTab = 'overview' | 'charts' | 'discussion' | 'positions' | 'activity';
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

  // Wallet balance
  let balance = $derived(getBalance());
  let hasBalance = $derived(balance > 0);

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
    { key: 'activity', label: 'Activity' },
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

  let showCopied = $state(false);
  let marketTrades = $state<Position[]>([]);

  // Tilt copy
  let tiltText = $derived(
    yesPrice > 0.7 ? 'Strong YES lean — bulls are in control' :
    yesPrice > 0.55 ? 'Mild YES lean — slight edge to YES' :
    yesPrice > 0.45 ? 'Near toss-up — market is undecided' :
    yesPrice > 0.3 ? 'Mild NO lean — slight edge to NO' :
    'Strong NO lean — bears are in control'
  );

  // Recent fills (kind 983 trade events)
  let recentFills = $state<NDKEvent[]>([]);

  type FillData = { side: 'YES' | 'NO'; sats: number; ts: number };

  function parseFillData(event: NDKEvent): FillData | null {
    let side: 'YES' | 'NO' | null = null;
    let sats = 0;
    const sideTag = event.tags.find((t: string[]) => t[0] === 'side')?.[1];
    const dirTag = event.tags.find((t: string[]) => t[0] === 'direction')?.[1];
    const satsTag = event.tags.find((t: string[]) => t[0] === 'sats' || t[0] === 'amount')?.[1];
    if (sideTag) side = (sideTag === 'LONG' || sideTag === 'yes') ? 'YES' : 'NO';
    else if (dirTag) side = (dirTag === 'LONG' || dirTag === 'yes') ? 'YES' : 'NO';
    if (satsTag) sats = parseInt(satsTag, 10);
    if (!side || !sats) {
      try {
        const parsed = JSON.parse(event.content);
        if (!side && parsed.side) side = (parsed.side === 'LONG' || parsed.side === 'yes') ? 'YES' : 'NO';
        if (!sats && (parsed.sats || parsed.amount)) sats = parsed.sats ?? parsed.amount;
      } catch { /* non-JSON content */ }
    }
    if (!side || sats <= 0) return null;
    return { side, sats, ts: ((event.created_at ?? 0) * 1000) };
  }

  $effect(() => {
    const m = market;
    if (!m) return;
    fetchEvents({ kinds: [983 as NDKKind], '#market': [m.slug] as any, limit: 8 })
      .then((eventsSet) => {
        recentFills = Array.from(eventsSet)
          .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
          .slice(0, 8);
      })
      .catch(() => {});
  });

  // Largest positioned accounts — grouped from marketTrades
  type AccountPos = { pubkey: string; long: number; short: number; total: number };
  let accountPositions = $derived.by((): AccountPos[] => {
    const map = new Map<string, AccountPos>();
    for (const pos of marketTrades) {
      const pk = pos.ownerPubkey ?? 'anon';
      const entry = map.get(pk) ?? { pubkey: pk, long: 0, short: 0, total: 0 };
      if (pos.direction === 'yes') entry.long += pos.quantity;
      else entry.short += pos.quantity;
      entry.total = entry.long + entry.short;
      map.set(pk, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  });

  function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showCopied = true;
        setTimeout(() => { showCopied = false; }, 2000);
      });
    }
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
      setTimeout(() => { tradeSuccess = false; }, 5000);
    }
  }
  
  function formatTradeTimestamp(tsMs: number): string {
    const now = Date.now();
    const diff = now - tsMs;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
  }

  function abbreviatePubkey(pubkey: string): string {
    if (!pubkey || pubkey.length <= 12) return pubkey || 'anon';
    return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`;
  }

  onMount(() => {
    const ndk = getNDK();
    const m = market;
    if (!ndk || !m) return;
    fetchAllPositions(ndk)
      .then((positions) => {
        marketTrades = positions
          .filter((p) => p.marketId === m.slug)
          .sort((a, b) => b.timestamp - a.timestamp);
      })
      .catch(() => {});
  });

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
          <div class="flex items-center gap-3">
            <button
              onclick={handleShare}
              class="text-sm text-neutral-400 hover:text-white"
            >
              {showCopied ? 'Copied!' : 'Share →'}
            </button>
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
          <p class="text-xs text-neutral-400 mt-2">{tiltText}</p>
        </div>
        
        <!-- Trade -->
        <div class="py-6 border-b border-neutral-800">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Trade</h2>
          <p class="text-xs text-neutral-500 mb-2">Balance: {balance} sats</p>
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
              {#if tradeError.includes('Insufficient balance')}
                {tradeError} <a href="/wallet" class="text-white underline">Deposit sats →</a>
              {:else}
                {tradeError}
              {/if}
            </div>
          {/if}
          
          <button
            onclick={handleTrade}
            disabled={tradeLoading || amount <= 0 || !isLoggedIn || !hasBalance}
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

          {#if tradeSuccess}
            <p class="text-sm text-emerald-400 mt-2">Trade confirmed. <a href="/portfolio" class="text-white underline">View portfolio →</a></p>
          {/if}

          {#if !isLoggedIn}
            <p class="mt-3 text-sm text-neutral-400">
              <a href="/join" class="text-white underline">Sign in</a> to trade
            </p>
          {:else if !hasBalance}
            <p class="text-xs text-neutral-400 mt-2">
              You need sats to trade. <a href="/wallet" class="text-neutral-300 hover:text-white">Fund your wallet →</a>
            </p>
          {/if}
        </div>
        
        <!-- Recent Fills -->
        {#if recentFills.length > 0}
          {@const parsedFills = recentFills.map(parseFillData).filter((f): f is FillData => f !== null)}
          {#if parsedFills.length > 0}
            <div class="py-6 border-b border-neutral-800">
              <h2 class="text-sm font-medium text-neutral-400 mb-3">Recent Fills</h2>
              <div class="space-y-1">
                {#each parsedFills as fill}
                  <div class="flex items-center gap-3 text-xs font-mono">
                    <span class="px-1.5 py-0.5 rounded text-xs font-medium {fill.side === 'YES' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}">{fill.side}</span>
                    <span class="text-neutral-300">{fill.sats.toLocaleString()} sats</span>
                    <span class="text-neutral-600 ml-auto">{formatTradeTimestamp(fill.ts)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Description -->
        <div class="py-6">
          <h2 class="text-sm font-medium text-neutral-400 mb-4">Description</h2>
          <p class="text-neutral-300 leading-relaxed">
            {market.description || 'No description provided.'}
          </p>
        </div>

        <!-- Largest Positioned Accounts -->
        {#if accountPositions.length > 0}
          <div class="py-6 border-t border-neutral-800">
            <h2 class="text-sm font-medium text-neutral-400 mb-3">Positions</h2>
            <div class="space-y-1.5">
              {#each accountPositions as acct}
                <div class="flex items-center gap-3 text-xs font-mono">
                  <span class="text-neutral-500 w-20 shrink-0">{acct.pubkey.slice(0, 8)}…</span>
                  {#if acct.long > 0}
                    <span class="text-emerald-400">{acct.long.toLocaleString()} YES</span>
                  {/if}
                  {#if acct.short > 0}
                    <span class="text-rose-400">{acct.short.toLocaleString()} NO</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {:else if activeTab === 'charts'}
        <div class="py-4">
          <PriceChart marketSlug={market.slug} />
          {#if marketTrades.length > 0}
            <div class="mt-6">
              <h2 class="text-sm font-medium text-neutral-400 mb-3">Recent fills</h2>
              <div class="divide-y divide-neutral-800">
                {#each marketTrades.slice(0, 20) as trade (trade.id)}
                  <div class="py-2 flex items-center gap-3 font-mono text-sm">
                    <span class="text-neutral-600 w-16 shrink-0">{formatTradeTimestamp(trade.timestamp)}</span>
                    <span class="text-neutral-500 w-28 shrink-0 truncate">{abbreviatePubkey(trade.ownerPubkey ?? '')}</span>
                    <span class={trade.direction === 'yes' ? 'text-emerald-400 w-20 shrink-0' : 'text-rose-400 w-20 shrink-0'}>
                      {trade.direction === 'yes' ? 'YES' : 'NO'}
                    </span>
                    <span class="text-neutral-300">· {Math.round(trade.costBasis).toLocaleString()} sats</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'discussion'}
        <MarketDiscussionList market={market} />
      {:else if activeTab === 'positions'}
        {#if accountPositions.length === 0}
          <div class="text-center py-12">
            <p class="text-neutral-500 text-sm">No positions yet</p>
          </div>
        {:else}
          <div class="py-4">
            <div class="border border-neutral-800">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-neutral-800 text-xs text-neutral-500">
                    <th class="text-left px-4 py-2 font-medium">Account</th>
                    <th class="text-right px-4 py-2 font-medium">YES</th>
                    <th class="text-right px-4 py-2 font-medium">NO</th>
                    <th class="text-right px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-800">
                  {#each accountPositions as acct}
                    <tr class="text-sm font-mono">
                      <td class="px-4 py-2 text-neutral-400">{abbreviatePubkey(acct.pubkey)}</td>
                      <td class="text-right px-4 py-2 {acct.long > 0 ? 'text-emerald-400' : 'text-neutral-600'}">{acct.long > 0 ? acct.long.toLocaleString() : '—'}</td>
                      <td class="text-right px-4 py-2 {acct.short > 0 ? 'text-rose-400' : 'text-neutral-600'}">{acct.short > 0 ? acct.short.toLocaleString() : '—'}</td>
                      <td class="text-right px-4 py-2 text-neutral-300">{acct.total.toLocaleString()}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      {:else if activeTab === 'activity'}
        {#if marketTrades.length === 0}
          <p class="text-neutral-500 text-sm py-8">No activity yet</p>
        {:else}
          <div class="divide-y divide-neutral-800">
            {#each marketTrades as trade (trade.id)}
              <div class="py-2 flex items-center gap-3 font-mono text-sm">
                <span class="text-neutral-600 w-16 shrink-0">{formatTradeTimestamp(trade.timestamp)}</span>
                <span class="text-neutral-500 w-28 shrink-0 truncate">{abbreviatePubkey(trade.ownerPubkey ?? '')}</span>
                <span class={trade.direction === 'yes' ? 'text-emerald-400 w-20 shrink-0' : 'text-rose-400 w-20 shrink-0'}>
                  bought {trade.direction === 'yes' ? 'YES' : 'NO'}
                </span>
                <span class="text-neutral-300">· {Math.round(trade.costBasis).toLocaleString()} sats</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
