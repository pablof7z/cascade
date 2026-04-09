<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fetchAllMarketsTransport, getNDK, fetchAllPayoutEvents } from '../../services/nostrService';
  import { fetchAllPositions } from '../../services/positionService';
  import { parseMarketEvent } from '../../services/marketService';
  import NavHeader from '$lib/components/NavHeader.svelte';

  type ActivityFilter = 'All' | 'New Markets' | 'Trades' | 'Resolutions';

  interface ActivityItem {
    id: string;
    timestamp: number;
    actor: string;
    action: string;
    marketId: string;
    marketName: string;
    marketType: string;
  }

  interface TradeItem {
    id: string;
    marketId: string;
    marketTitle: string;
    direction: 'yes' | 'no';
    traderPubkey: string;
    traderName: string;
    timestamp: number;
  }

  interface ResolutionItem {
    id: string;
    marketId: string;
    marketTitle: string;
    outcome: 'YES' | 'NO';
    winnerPubkey: string;
    winnerName: string;
    netSats: number;
    timestamp: number;
  }

  const filters: ActivityFilter[] = ['All', 'New Markets', 'Trades', 'Resolutions'];

  let activeFilter = $state<ActivityFilter>('All');
  let items = $state<ActivityItem[]>([]);
  let trades = $state<TradeItem[]>([]);
  let resolutions = $state<ResolutionItem[]>([]);
  let marketsMap = $state<Map<string, string>>(new Map());
  let error = $state<string | null>(null);
  let marketsError = $state<string | null>(null);

  // Cache for pubkey -> name lookups
  const nameCache = new Map<string, string>();

  function formatTimestamp(ts: number): string {
    const now = Date.now();
    const diff = now - ts * 1000;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return 'just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
  }

  function abbreviatePubkey(pubkey: string): string {
    if (pubkey.length <= 12) return pubkey;
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  }

  async function getUserName(pubkey: string): Promise<string> {
    if (!pubkey) return 'Anonymous';
    if (nameCache.has(pubkey)) {
      return nameCache.get(pubkey)!;
    }

    const ndk = getNDK();
    if (!ndk) return 'Anonymous';

    try {
      const { fetchKind0Metadata } = await import('../../services/nostrService');
      const metadata = await fetchKind0Metadata(ndk, pubkey);
      const name = metadata?.name || 'Anonymous';
      nameCache.set(pubkey, name);
      return name;
    } catch {
      return 'Anonymous';
    }
  }

  // Computed
  let showEmptyState = $derived(
    activeFilter === 'Trades' && trades.length === 0 ||
    activeFilter === 'Resolutions' && resolutions.length === 0
  );

  let emptyStateMessage = $derived(
    activeFilter === 'Trades' ? 'No trade activity yet' : 'No resolutions yet'
  );

  let filteredItems = $derived(
    activeFilter === 'New Markets' ? items :
    activeFilter === 'All' ? items : []
  );

  onMount(() => {
    let cancelled = false;

    async function loadMarkets() {
      const ndk = getNDK();
      if (!ndk) return;

      try {
        const events = await fetchAllMarketsTransport(500);
        if (cancelled) return;

        const map = new Map<string, string>();
        for (const event of events) {
          const result = parseMarketEvent(event);
          if (result.ok && result.market) {
            map.set(result.market.slug, result.market.title);
          }
        }
        if (!cancelled) {
          marketsMap = map;
        }
      } catch (err) {
        console.warn('[Activity] Failed to load markets for title lookups:', err);
      }
    }

    async function loadNewMarkets() {
      const ndk = getNDK();
      if (!ndk) return;

      if (!cancelled) setMarketsError(null);

      try {
        const events = await fetchAllMarketsTransport(50);
        if (cancelled) return;

        const activityItems: ActivityItem[] = [];
        for (const event of events) {
          const result = parseMarketEvent(event);
          if (!result.ok) continue;
          const market = result.market;
          if (market.status === 'archived') continue;

          activityItems.push({
            id: market.slug,
            timestamp: event.created_at ?? market.createdAt ?? 0,
            actor: await getUserName(event.pubkey ?? market.creatorPubkey ?? ''),
            action: `created ${market.kind ?? 'market'}`,
            marketId: market.slug,
            marketName: market.title,
            marketType: market.kind ?? 'module',
          });
        }

        activityItems.sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) {
          items = activityItems;
          if (activityItems.length === 0) {
            setMarketsError("Couldn't connect to server — check your connection");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMarketsError(err instanceof Error ? err.message : "Couldn't load activity — check your connection");
        }
      }
    }

    async function loadTrades() {
      const ndk = getNDK();
      if (!ndk) return;

      try {
        const positions = await fetchAllPositions(ndk);
        if (cancelled) return;

        const tradeItems: TradeItem[] = [];
        for (const position of positions) {
          const marketTitle = marketsMap.get(position.marketId) || position.marketId;
          const ownerPubkey = position.ownerPubkey || '';

          tradeItems.push({
            id: `${position.marketId}-${position.direction}-${position.timestamp}`,
            marketId: position.marketId,
            marketTitle,
            direction: position.direction,
            traderPubkey: ownerPubkey,
            traderName: await getUserName(ownerPubkey),
            timestamp: position.timestamp,
          });
        }

        if (!cancelled) {
          trades = tradeItems.sort((a, b) => b.timestamp - a.timestamp);
        }
      } catch (err) {
        console.warn('[Activity] Failed to load trades:', err);
      }
    }

    async function loadResolutions() {
      try {
        const events = await fetchAllPayoutEvents();
        if (cancelled) return;

        const resolutionItems: ResolutionItem[] = [];
        for (const event of events) {
          const marketTag = event.getMatchingTags('market')[0]?.[1];
          const marketTitleTag = event.getMatchingTags('market-title')[0]?.[1];
          const winnerTag = event.getMatchingTags('winner')[0]?.[1];
          const outcomeTag = event.getMatchingTags('outcome')[0]?.[1];
          const netSatsTag = event.getMatchingTags('net-sats')[0]?.[1];
          const resolvedAtTag = event.getMatchingTags('resolved-at')[0]?.[1];

          if (!marketTag) continue;

          resolutionItems.push({
            id: event.id,
            marketId: marketTag,
            marketTitle: marketTitleTag || marketTag,
            outcome: (outcomeTag as 'YES' | 'NO') || 'YES',
            winnerPubkey: winnerTag || event.pubkey || '',
            winnerName: await getUserName(winnerTag || event.pubkey || ''),
            netSats: netSatsTag ? parseInt(netSatsTag, 10) : 0,
            timestamp: resolvedAtTag ? parseInt(resolvedAtTag, 10) : event.created_at ?? 0,
          });
        }

        if (!cancelled) {
          resolutions = resolutionItems.sort((a, b) => b.timestamp - a.timestamp);
        }
      } catch (err) {
        console.warn('[Activity] Failed to load resolutions:', err);
      }
    }

    // Load all data
    Promise.all([loadNewMarkets(), loadResolutions()]);

    // Load trades after markets map is ready
    loadTrades().catch(() => {});

    return () => {
      cancelled = true;
    };
  });

  function handleRetry() {
    marketsError = null;
  }

  function navigateToMarket(marketId: string) {
    goto(`/mkt/${marketId}`);
  }
</script>

<svelte:head>
  <title>Activity | Cascade</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
  <NavHeader />
  <h1 class="text-2xl font-sans text-white mb-6">Activity</h1>

  <nav class="flex gap-1 border-b border-neutral-800 mb-6">
    {#each filters as filter}
      <button
        type="button"
        onclick={() => activeFilter = filter}
        class="-mb-px px-4 py-2 text-sm font-medium transition-colors {activeFilter === filter ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        {filter}
      </button>
    {/each}
  </nav>

  {#if error}
    <p class="text-neutral-500 text-sm py-8 text-center">{error}</p>
  {/if}

  {#if !error && showEmptyState}
    <p class="text-neutral-500 text-sm py-8 text-center">{emptyStateMessage}</p>
  {/if}

  {#if !error && activeFilter === 'New Markets'}
    {#if marketsError}
      <div class="flex flex-col items-center justify-center py-12 gap-4">
        <p class="text-rose-400 text-sm">{marketsError}</p>
        <button
          type="button"
          onclick={handleRetry}
          class="px-4 py-2 text-sm font-medium bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
        >
          Retry
        </button>
      </div>
    {:else if items.length === 0}
      <p class="text-neutral-500 text-sm py-8 text-center">No markets found</p>
    {:else}
      <div class="divide-y divide-neutral-800">
        {#each items as item (item.id)}
          <div class="flex items-start gap-4 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-white text-sm font-medium">{item.actor}</span>
                <span class="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
              </div>
              <div class="text-neutral-300 text-sm mb-1">{item.action}</div>
              <button
                type="button"
                onclick={() => navigateToMarket(item.marketId)}
                class="text-sm text-neutral-400 hover:text-neutral-200 transition-colors text-left"
              >
                {item.marketName}
              </button>
            </div>
            <span class="text-xs text-neutral-600 uppercase tracking-wide shrink-0">
              {item.marketType}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if !error && activeFilter === 'Trades'}
    {#if trades.length === 0}
      <p class="text-neutral-500 text-sm py-8 text-center">No trade activity yet</p>
    {:else}
      <div class="divide-y divide-neutral-800">
        {#each trades as trade (trade.id)}
          <div class="flex items-start gap-4 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-white text-sm font-medium">{trade.traderName}</span>
                <span class="text-xs text-neutral-500">{formatTimestamp(trade.timestamp)}</span>
              </div>
              <div class="text-neutral-300 text-sm mb-2">
                Opened
                <span class={trade.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                  {trade.direction.toUpperCase()}
                </span>
                position
              </div>
              <button
                type="button"
                onclick={() => navigateToMarket(trade.marketId)}
                class="text-sm text-neutral-400 hover:text-neutral-200 transition-colors text-left"
              >
                {trade.marketTitle}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if !error && activeFilter === 'Resolutions'}
    {#if resolutions.length === 0}
      <p class="text-neutral-500 text-sm py-8 text-center">No resolutions yet</p>
    {:else}
      <div class="divide-y divide-neutral-800">
        {#each resolutions as resolution (resolution.id)}
          <div class="flex items-start gap-4 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-white text-sm font-medium">{resolution.marketTitle}</span>
                <span class="text-xs text-neutral-500">{formatTimestamp(resolution.timestamp)}</span>
              </div>
              <div class="text-neutral-300 text-sm mb-1">
                Resolved
                <span class={resolution.outcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>
                  {resolution.outcome}
                </span>
              </div>
              <div class="text-neutral-400 text-sm">
                <span class="text-white">{resolution.winnerName}</span>
                {' won '}
                <span class="text-emerald-400 font-mono">{resolution.netSats.toLocaleString()} sats</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if !error && activeFilter === 'All'}
    {#if items.length === 0 && trades.length === 0 && resolutions.length === 0}
      <p class="text-neutral-500 text-sm py-8 text-center">No activity found</p>
    {:else}
      <div class="divide-y divide-neutral-800">
        {#each [...items, ...trades, ...resolutions]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50) as item (item.id)}
          <div class="flex items-start gap-4 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-white text-sm font-medium">
                  {'traderName' in item ? item.traderName : 'winnerName' in item ? item.winnerName : item.actor}
                </span>
                <span class="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
              </div>
              <div class="text-neutral-300 text-sm">
                {#if 'traderName' in item}
                  Opened
                  <span class={item.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                    {item.direction.toUpperCase()}
                  </span>
                  position
                {:else if 'winnerName' in item}
                  Resolved
                  <span class={item.outcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>
                    {item.outcome}
                  </span>
                {:else}
                  {item.action}
                {/if}
              </div>
              <button
                type="button"
                onclick={() => navigateToMarket(item.marketId)}
                class="text-sm text-neutral-400 hover:text-neutral-200 transition-colors text-left mt-1"
              >
                {item.marketName || item.marketTitle}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>