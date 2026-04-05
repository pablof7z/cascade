<script lang="ts">
  import { onMount } from 'svelte';
  import { trackEvent, initAnalytics, destroyAnalytics } from '../../analytics';

  let loading = $state(true);

  onMount(() => {
    // Initialize client-side analytics tracking
    initAnalytics();

    // Track page view
    trackEvent('page_view', { path: '/analytics' });

    // Simulate brief loading state
    setTimeout(() => {
      loading = false;
    }, 300);

    return () => {
      destroyAnalytics();
    };
  });

  function handleReset() {
    if (confirm('Reset analytics session? This will clear your current session data.')) {
      destroyAnalytics();
      initAnalytics();
      trackEvent('analytics_reset', {});
      window.location.reload();
    }
  }
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
      <p class="text-neutral-500 text-sm">Loading...</p>
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center py-24 gap-6">
      <div class="w-12 h-12 flex items-center justify-center">
        <svg class="w-10 h-10 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      <div class="text-center">
        <h2 class="text-xl font-sans text-white mb-2">Analytics Dashboard</h2>
        <p class="text-neutral-400 text-sm max-w-md">
          Usage analytics and market insights are being compiled.
          The dashboard will display aggregated data once sufficient activity is recorded.
        </p>
      </div>
      <p class="text-xs text-neutral-600 mt-4">
        Your session is being tracked anonymously.
      </p>
    </div>
  {/if}
</div>
