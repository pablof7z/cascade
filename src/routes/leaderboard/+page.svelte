<script lang="ts">
  import { isReady, fetchEvents, fetchAllMarketsTransport, fetchAllPayoutEvents, getNDK, fetchKind0Metadata } from '../../services/nostrService'
  import type { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk'
  import NavHeader from '$lib/components/NavHeader.svelte'

  // ─── Types ──────────────────────────────────────────────────────────────────

  type Tab = 'traders' | 'creators' | 'active'
  type TimeFilter = 'all' | 'month' | 'week'

  type TraderRow = { pubkey: string; netSats: number; tradeCount: number }
  type CreatorRow = { pubkey: string; marketsCreated: number }
  type ActiveRow = { pubkey: string; tradeCount: number; marketsTraded: number }

  // ─── State ──────────────────────────────────────────────────────────────────

  let activeTab = $state<Tab>('traders')
  let timeFilter = $state<TimeFilter>('all')
  let loaded = $state(false)

  let payoutEvents = $state<NDKEvent[]>([])
  let marketEvents = $state<NDKEvent[]>([])
  let tradeEvents = $state<NDKEvent[]>([])
  let displayNames = $state<Record<string, string>>({})

  const pendingNames = new Set<string>()

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function shortPubkey(pk: string): string {
    return pk.slice(0, 8) + '…' + pk.slice(-4)
  }

  function getTimeFilterCutoff(): number {
    const now = Math.floor(Date.now() / 1000)
    if (timeFilter === 'week') return now - 7 * 24 * 3600
    if (timeFilter === 'month') return now - 30 * 24 * 3600
    return 0
  }

  function rankColor(i: number): string {
    if (i === 0) return 'text-white'
    if (i === 1) return 'text-neutral-300'
    if (i === 2) return 'text-neutral-400'
    return 'text-neutral-600'
  }

  // ─── Profile name resolution ─────────────────────────────────────────────────

  async function loadName(pubkey: string) {
    if (pendingNames.has(pubkey)) return
    pendingNames.add(pubkey)
    const ndk = getNDK()
    if (!ndk) return
    try {
      const meta = await fetchKind0Metadata(ndk, pubkey)
      if (meta?.name) {
        displayNames = { ...displayNames, [pubkey]: meta.name }
      }
    } catch {
      // non-fatal — leave pubkey truncated
    }
  }

  // Fire off name loading whenever raw event data changes
  $effect(() => {
    const all = new Set<string>()
    for (const e of payoutEvents) {
      const r = (e.tags ?? []).find((t: string[]) => t[0] === 'redeemer')?.[1]
      if (r) all.add(r)
    }
    for (const e of marketEvents) {
      if (e.pubkey) all.add(e.pubkey)
    }
    for (const e of tradeEvents) {
      if (e.pubkey) all.add(e.pubkey)
    }
    for (const pk of all) loadName(pk)
  })

  // ─── Derived leaderboard rows ────────────────────────────────────────────────

  let traderRows = $derived.by((): TraderRow[] => {
    // reactive on: payoutEvents, timeFilter, displayNames (via names read below)
    void displayNames
    const cut = getTimeFilterCutoff()
    const byPk = new Map<string, { netSats: number; trades: number }>()
    for (const e of payoutEvents) {
      if (cut > 0 && (e.created_at ?? 0) < cut) continue
      const redeemer = (e.tags ?? []).find((t: string[]) => t[0] === 'redeemer')?.[1]
      if (!redeemer) continue
      const netStr = (e.tags ?? []).find((t: string[]) => t[0] === 'payout-sats')?.[1] ?? '0'
      const net = parseInt(netStr, 10) || 0
      const entry = byPk.get(redeemer) ?? { netSats: 0, trades: 0 }
      entry.netSats += net
      entry.trades++
      byPk.set(redeemer, entry)
    }
    return Array.from(byPk.entries())
      .map(([pk, d]) => ({ pubkey: pk, netSats: d.netSats, tradeCount: d.trades }))
      .sort((a, b) => b.netSats - a.netSats)
      .slice(0, 20)
  })

  let creatorRows = $derived.by((): CreatorRow[] => {
    void displayNames
    const cut = getTimeFilterCutoff()
    const byPk = new Map<string, number>()
    for (const e of marketEvents) {
      if (cut > 0 && (e.created_at ?? 0) < cut) continue
      if (!e.pubkey) continue
      byPk.set(e.pubkey, (byPk.get(e.pubkey) ?? 0) + 1)
    }
    return Array.from(byPk.entries())
      .map(([pk, count]) => ({ pubkey: pk, marketsCreated: count }))
      .sort((a, b) => b.marketsCreated - a.marketsCreated)
      .slice(0, 20)
  })

  let activeRows = $derived.by((): ActiveRow[] => {
    void displayNames
    const cut = getTimeFilterCutoff()
    // Prefer kind 983 trade events if available; else use payout events as proxy
    const src = tradeEvents.length > 0 ? tradeEvents : payoutEvents
    const byPk = new Map<string, { trades: number; markets: Set<string> }>()
    for (const e of src) {
      if (cut > 0 && (e.created_at ?? 0) < cut) continue
      // For kind 30079 payout events the redeemer tag is the trader pubkey
      const redeemer = (e.tags ?? []).find((t: string[]) => t[0] === 'redeemer')?.[1]
      const pk = redeemer ?? e.pubkey
      if (!pk) continue
      const mkt = (e.tags ?? []).find((t: string[]) => t[0] === 'market')?.[1] ?? ''
      const entry = byPk.get(pk) ?? { trades: 0, markets: new Set() }
      entry.trades++
      if (mkt) entry.markets.add(mkt)
      byPk.set(pk, entry)
    }
    return Array.from(byPk.entries())
      .map(([pk, d]) => ({ pubkey: pk, tradeCount: d.trades, marketsTraded: d.markets.size }))
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 20)
  })

  // ─── Data loading ────────────────────────────────────────────────────────────

  $effect(() => {
    if (isReady()) {
      loadData()
      return
    }
    const interval = setInterval(() => {
      if (isReady()) {
        clearInterval(interval)
        loadData()
      }
    }, 100)
    return () => clearInterval(interval)
  })

  async function loadData() {
    try {
      const [payouts, markets, trades983] = await Promise.all([
        fetchAllPayoutEvents(),
        fetchAllMarketsTransport(500),
        fetchEvents({ kinds: [983 as NDKKind], limit: 500 }).catch(() => new Set<NDKEvent>()),
      ])
      payoutEvents = payouts
      marketEvents = Array.from(markets)
      tradeEvents = Array.from(trades983)
    } catch {
      // non-fatal
    } finally {
      loaded = true
    }
  }

  // ─── UI constants ────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'traders', label: 'Top Traders' },
    { id: 'creators', label: 'Top Creators' },
    { id: 'active', label: 'Most Active' },
  ]

  const timeFilters: { id: TimeFilter; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'month', label: 'This Month' },
    { id: 'week', label: 'This Week' },
  ]
</script>

<svelte:head>
  <title>Leaderboard | Cascade</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <NavHeader />

  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-sans text-white">Leaderboard</h1>
    <p class="text-xs text-neutral-500 mt-1">Ranked by real on-chain Nostr activity</p>
  </div>

  <!-- Tab bar + time filter -->
  <div class="flex items-end justify-between border-b border-neutral-800 mb-6">
    <nav class="flex gap-0">
      {#each tabs as tab}
        <button
          type="button"
          onclick={() => (activeTab = tab.id)}
          class="-mb-px px-4 py-2 text-sm font-medium transition-colors {activeTab === tab.id
            ? 'border-b-2 border-white text-white'
            : 'text-neutral-500 hover:text-neutral-300'}"
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    <div class="flex items-center gap-1 pb-2">
      {#each timeFilters as tf}
        <button
          type="button"
          onclick={() => (timeFilter = tf.id)}
          class="px-2 py-0.5 text-xs font-medium transition-colors {timeFilter === tf.id
            ? 'bg-neutral-700 text-white'
            : 'text-neutral-500 hover:text-neutral-300'}"
        >
          {tf.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Top Traders table -->
  {#if activeTab === 'traders'}
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-neutral-800">
          <th class="text-left py-2 font-medium text-neutral-500 text-xs w-8">#</th>
          <th class="text-left py-2 font-medium text-neutral-500 text-xs">User</th>
          <th class="text-right py-2 font-medium text-neutral-500 text-xs pl-4 whitespace-nowrap">Total P&amp;L (sats)</th>
          <th class="text-right py-2 font-medium text-neutral-500 text-xs pl-4 whitespace-nowrap">Trade Count</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-800/60">
        {#if !loaded}
          {#each { length: 5 } as _, i}
            <tr>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">{i + 1}</td>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">—</td>
              <td class="py-2.5 text-right text-neutral-600 font-mono text-xs pl-4">—</td>
              <td class="py-2.5 text-right text-neutral-600 font-mono text-xs pl-4">—</td>
            </tr>
          {/each}
        {:else if traderRows.length === 0}
          <tr>
            <td colspan="4" class="py-8 text-center text-neutral-500 text-sm">No activity yet</td>
          </tr>
        {:else}
          {#each traderRows as row, i}
            <tr>
              <td class="py-2.5 font-mono text-xs {rankColor(i)}">{i + 1}</td>
              <td class="py-2.5 font-mono text-xs text-neutral-300">
                {displayNames[row.pubkey] ?? shortPubkey(row.pubkey)}
              </td>
              <td class="py-2.5 text-right font-mono text-xs pl-4 tabular-nums {row.netSats >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                {row.netSats >= 0 ? '+' : ''}{row.netSats.toLocaleString()}
              </td>
              <td class="py-2.5 text-right font-mono text-xs pl-4 tabular-nums text-neutral-400">
                {row.tradeCount}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  {/if}

  <!-- Top Creators table -->
  {#if activeTab === 'creators'}
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-neutral-800">
          <th class="text-left py-2 font-medium text-neutral-500 text-xs w-8">#</th>
          <th class="text-left py-2 font-medium text-neutral-500 text-xs">User</th>
          <th class="text-right py-2 font-medium text-neutral-500 text-xs pl-4 whitespace-nowrap">Markets Created</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-800/60">
        {#if !loaded}
          {#each { length: 5 } as _, i}
            <tr>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">{i + 1}</td>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">—</td>
              <td class="py-2.5 text-right text-neutral-600 font-mono text-xs pl-4">—</td>
            </tr>
          {/each}
        {:else if creatorRows.length === 0}
          <tr>
            <td colspan="3" class="py-8 text-center text-neutral-500 text-sm">No activity yet</td>
          </tr>
        {:else}
          {#each creatorRows as row, i}
            <tr>
              <td class="py-2.5 font-mono text-xs {rankColor(i)}">{i + 1}</td>
              <td class="py-2.5 font-mono text-xs text-neutral-300">
                {displayNames[row.pubkey] ?? shortPubkey(row.pubkey)}
              </td>
              <td class="py-2.5 text-right font-mono text-xs pl-4 tabular-nums text-neutral-400">
                {row.marketsCreated}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  {/if}

  <!-- Most Active table -->
  {#if activeTab === 'active'}
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-neutral-800">
          <th class="text-left py-2 font-medium text-neutral-500 text-xs w-8">#</th>
          <th class="text-left py-2 font-medium text-neutral-500 text-xs">User</th>
          <th class="text-right py-2 font-medium text-neutral-500 text-xs pl-4 whitespace-nowrap">Trade Count</th>
          <th class="text-right py-2 font-medium text-neutral-500 text-xs pl-4 whitespace-nowrap">Markets Traded</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-800/60">
        {#if !loaded}
          {#each { length: 5 } as _, i}
            <tr>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">{i + 1}</td>
              <td class="py-2.5 text-neutral-600 font-mono text-xs">—</td>
              <td class="py-2.5 text-right text-neutral-600 font-mono text-xs pl-4">—</td>
              <td class="py-2.5 text-right text-neutral-600 font-mono text-xs pl-4">—</td>
            </tr>
          {/each}
        {:else if activeRows.length === 0}
          <tr>
            <td colspan="4" class="py-8 text-center text-neutral-500 text-sm">No activity yet</td>
          </tr>
        {:else}
          {#each activeRows as row, i}
            <tr>
              <td class="py-2.5 font-mono text-xs {rankColor(i)}">{i + 1}</td>
              <td class="py-2.5 font-mono text-xs text-neutral-300">
                {displayNames[row.pubkey] ?? shortPubkey(row.pubkey)}
              </td>
              <td class="py-2.5 text-right font-mono text-xs pl-4 tabular-nums text-neutral-400">
                {row.tradeCount}
              </td>
              <td class="py-2.5 text-right font-mono text-xs pl-4 tabular-nums text-neutral-500">
                {row.marketsTraded}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  {/if}
</div>
