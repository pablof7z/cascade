<script lang="ts">
  import { goto } from '$app/navigation';
  import { forceRefreshBalance, initWalletStore } from '$lib/stores/wallet.svelte';

  // Local state
  let isOpen = $state(false);
  let dropdownRef = $state<HTMLDivElement | null>(null);
  let balance = $state(0);
  let error = $state<string | null>(null);
  let isRefreshing = $state(false);

  // Initialize wallet store on mount
  $effect(() => {
    initWalletStore();
  });

  // Periodic refresh (replaces 30-second polling with controlled refresh)
  $effect(() => {
    const interval = setInterval(() => {
      forceRefreshBalance();
    }, 30000);
    return () => clearInterval(interval);
  });

  // Close dropdown when clicking outside
  $effect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        isOpen = false;
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  function formatSats(amount: number): string {
    return amount.toLocaleString();
  }

  function handleRefresh() {
    forceRefreshBalance();
  }

  function closeDropdown() {
    isOpen = false;
  }
</script>

<div class="relative" bind:this={dropdownRef}>
  <!-- Trigger Button -->
  <button
    onclick={() => isOpen = !isOpen}
    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-sm transition-colors"
  >
    <!-- Wallet Icon -->
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>

    <!-- Balance -->
    <div class="hidden sm:flex items-center gap-2">
      {#if isRefreshing}
        <span class="text-xs text-neutral-500">Syncing...</span>
      {:else}
        <span class="font-mono text-xs {error ? 'text-neutral-500' : 'text-white'}">
          {formatSats(balance)}
        </span>
        <span class="text-xs text-neutral-500">sats</span>
      {/if}
    </div>

    <!-- Chevron -->
    <svg
      class="w-4 h-4 transition-transform {isOpen ? 'rotate-180' : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- Dropdown -->
  {#if isOpen}
    <div class="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-700 py-1 z-50">
      <!-- Balance Header -->
      <div class="px-4 py-3 border-b border-neutral-700">
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-500">Balance</span>
          <button
            onclick={handleRefresh}
            disabled={isRefreshing}
            class="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {#if error}
          <p class="text-xs text-neutral-500 mt-1">{error}</p>
          <p class="font-mono text-lg text-neutral-500 mt-1">
            {formatSats(balance)} sats
          </p>
        {:else}
          <p class="font-mono text-xl text-white">
            {formatSats(balance)} <span class="text-sm text-neutral-400">sats</span>
          </p>
        {/if}
      </div>

      <!-- Quick Actions -->
      <a
        href="/wallet"
        class="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        onclick={closeDropdown}
      >
        View Wallet
      </a>
      <a
        href="/portfolio"
        class="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        onclick={closeDropdown}
      >
        Portfolio
      </a>
    </div>
  {/if}
</div>
