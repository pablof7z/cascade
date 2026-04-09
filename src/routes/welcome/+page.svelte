<script lang="ts">
  import { goto } from '$app/navigation';
  import { nostrStore, reconnect } from '$lib/stores/nostr';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import { onMount } from 'svelte';
  import { importNsecKey, saveKeys } from '../../nostrKeys';

  // Subscribe to Nostr store for reactive auth state
  let pubkey = $state<string | null>(null);
  let isReady = $state(false);
  let connecting = $state(false);

  // Key restore state
  let nsecInput = $state('');
  let nsecError = $state('');
  let importing = $state(false);

  onMount(() => {
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
      isReady = state.isReady;
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  });

  // Redirect if already authenticated
  $effect(() => {
    if (pubkey !== null && isReady) {
      goto('/');
    }
  });

  async function handleConnect() {
    connecting = true;
    try {
      await reconnect();
    } catch (err) {
      console.error('Failed to connect:', err);
      connecting = false;
    }
  }

  async function handleKeyImport() {
    nsecError = '';
    const trimmed = nsecInput.trim();
    if (!trimmed.startsWith('nsec1')) {
      nsecError = 'Invalid key format';
      return;
    }
    importing = true;
    try {
      const keys = importNsecKey(trimmed);
      saveKeys(keys);
      goto('/discuss');
    } catch (err) {
      nsecError = 'Invalid key format';
      importing = false;
    }
  }
</script>

<svelte:head>
  <title>Welcome — Cascade</title>
</svelte:head>

<NavHeader />
<main class="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6">
  <div class="max-w-md w-full text-center space-y-8">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold text-white">Welcome back</h1>
      <p class="text-neutral-400 text-sm">Sign in to start trading.</p>
    </div>

    <div class="space-y-3">
      <button
        onclick={handleConnect}
        disabled={connecting}
        class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors"
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>

      <div class="flex items-center gap-3 py-1">
        <div class="flex-1 h-px bg-neutral-800"></div>
        <span class="text-xs text-neutral-500">or</span>
        <div class="flex-1 h-px bg-neutral-800"></div>
      </div>

      <div class="space-y-2 text-left">
        <input
          type="password"
          bind:value={nsecInput}
          placeholder="nsec1..."
          class="w-full bg-neutral-900 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
        />
        {#if nsecError}
          <p class="text-sm text-rose-400">{nsecError}</p>
        {/if}
        <button
          onclick={handleKeyImport}
          disabled={importing || !nsecInput.trim()}
          class="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? 'Importing...' : 'Restore with key'}
        </button>
      </div>

      <div class="text-neutral-500 text-xs">
        New here? <a href="/join" class="text-neutral-300 hover:text-white transition-colors">Create an account</a>
      </div>

      <a
        href="/discuss"
        class="block w-full px-4 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors text-center"
      >
        Browse without signing in
      </a>
    </div>
  </div>
</main>
