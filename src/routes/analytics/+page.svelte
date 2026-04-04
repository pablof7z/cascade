<script lang="ts">
  import { onMount } from 'svelte';
  import { trackEvent, initAnalytics, destroyAnalytics } from '../../analytics';
  import type { AnalyticsSummary } from '../../analyticsTypes';

  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return { label, pct };
  }

  // Mock summary for demo - in production this would come from analytics service
  let summary = $state<AnalyticsSummary | null>(null);
  let loading = $state(true);
  let loadStart = $state(0);

  onMount(() => {
    loadStart = Date.now();
    initAnalytics();

    // Track page view
    trackEvent('page_view', { path: '/analytics' });

    // Simulate loading analytics data
    setTimeout(() => {
      summary = {
        dailyActiveSessions: 42,
        weeklyActiveSessions: 156,
        funnel: {
          landingViews: 1000,
          homepageEngaged: 680,
          marketViews: 420,
          discussionOpens: 180,
          tradesPlaced: 45,
          windowDays: 7,
        },
        topMarkets: [
          { marketId: 'bitcoin-price-2024', views: 234 },
          { marketId: 'ai-consciousness', views: 189 },
          { marketId: 'election-2024', views: 156 },
        ],
        homepageSources: [
          { source: 'direct', destination: '/', sessions: 89, events: 234 },
          { source: 'twitter', destination: '/', sessions: 67, events: 178 },
          { source: 'nostr', destination: '/', sessions: 34, events: 89 },
        ],
        averageSessionDuration: 180000, // 3 minutes
        generatedAt: Date.now(),
      };
      loading = false;
    }, 500);
  });

  function handleReset() {
    if (confirm('Reset analytics session? This will clear your current session data.')) {
      destroyAnalytics();
      initAnalytics();
      trackEvent('analytics_reset', {});
      window.location.reload();
    }
  }

  // Derived values
  let loadDuration = $derived(
    loading ? null : (Date.now() - loadStart)
  );

  let funnelBars = $derived(
    summary ? [
      FunnelBar({ label: 'Landing', value: summary.funnel.landingViews, max: summary.funnel.landingViews }),
      FunnelBar({ label: 'Engaged', value: summary.funnel.homepageEngaged, max: summary.funnel.landingViews }),
      FunnelBar({ label: 'Market Views', value: summary.funnel.marketViews, max: summary.funnel.landingViews }),
      FunnelBar({ label: 'Discussions', value: summary.funnel.discussionOpens, max: summary.funnel.landingViews }),
      FunnelBar({ label: 'Trades', value: summary.funnel.tradesPlaced, max: summary.funnel.landingViews }),
    ] : []
  );
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-sans text-white">Analytics</h1>
    <button
      type="button"
      onclick={handleReset}
      class="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
    >
      Reset Session
    </button>
  </div>

  {#if loading}
    <div class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin"></div>
      <p class="text-neutral-500 text-sm">Loading analytics...</p>
    </div>
  {:else if summary}
    <div class="space-y-8">
      <!-- Sessions Overview -->
      <section>
        <h2 class="text-lg font-sans text-white mb-4">Sessions</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-neutral-900 border border-neutral-800 p-4">
            <p class="text-xs text-neutral-500 uppercase tracking-wide mb-1">Today</p>
            <p class="text-3xl font-mono text-white">{summary.dailyActiveSessions}</p>
          </div>
          <div class="bg-neutral-900 border border-neutral-800 p-4">
            <p class="text-xs text-neutral-500 uppercase tracking-wide mb-1">This Week</p>
            <p class="text-3xl font-mono text-white">{summary.weeklyActiveSessions}</p>
          </div>
        </div>
      </section>

      <!-- Funnel -->
      <section>
        <h2 class="text-lg font-sans text-white mb-4">Funnel ({summary.funnel.windowDays}d)</h2>
        <div class="space-y-3">
          {#each funnelBars as bar}
            <div class="flex items-center gap-4">
              <span class="text-sm text-neutral-400 w-24 text-right">{bar.label}</span>
              <div class="flex-1 h-6 bg-neutral-900">
                <div
                  class="h-full bg-white transition-all"
                  style="width: {bar.pct}%"
                ></div>
              </div>
              <span class="text-sm font-mono text-neutral-300 w-16">{bar.pct}%</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Top Markets -->
      {#if summary.topMarkets.length > 0}
        <section>
          <h2 class="text-lg font-sans text-white mb-4">Top Markets</h2>
          <div class="bg-neutral-900 border border-neutral-800">
            <div class="divide-y divide-neutral-800">
              {#each summary.topMarkets as market}
                <div class="flex items-center justify-between px-4 py-3">
                  <span class="text-sm text-neutral-300 truncate">{market.marketId}</span>
                  <span class="text-sm font-mono text-neutral-400">{market.views}</span>
                </div>
              {/each}
            </div>
          </div>
        </section>
      {/if}

      <!-- Homepage Sources -->
      {#if summary.homepageSources.length > 0}
        <section>
          <h2 class="text-lg font-sans text-white mb-4">Homepage Sources</h2>
          <div class="bg-neutral-900 border border-neutral-800">
            <div class="divide-y divide-neutral-800">
              {#each summary.homepageSources as source}
                <div class="flex items-center justify-between px-4 py-3">
                  <div>
                    <span class="text-sm text-neutral-300">{source.source}</span>
                    <span class="text-xs text-neutral-600 ml-2">→ {source.destination}</span>
                  </div>
                  <div class="flex items-center gap-6">
                    <span class="text-xs text-neutral-500">{source.sessions} sessions</span>
                    <span class="text-sm font-mono text-neutral-400">{source.events} events</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </section>
      {/if}

      <!-- Session Duration -->
      <section>
        <h2 class="text-lg font-sans text-white mb-4">Avg Session Duration</h2>
        <div class="bg-neutral-900 border border-neutral-800 p-4">
          <p class="text-2xl font-mono text-white">{formatDuration(summary.averageSessionDuration)}</p>
        </div>
      </section>

      <!-- Meta -->
      <div class="text-xs text-neutral-600">
        Generated {new Date(summary.generatedAt).toLocaleString()}
        {#if loadDuration !== null}
          · Loaded in {formatDuration(loadDuration)}
        {/if}
      </div>
    </div>
  {:else}
    <p class="text-neutral-500 text-center py-8">No analytics data available yet.</p>
  {/if}
</div>