<script lang="ts">
  import { goto } from '$app/navigation';
  import { nostrStore, reconnect } from '$lib/stores/nostr';
  import { onMount } from 'svelte';

  // Subscribe to Nostr store for reactive auth state
  let pubkey = $state<string | null>(null);
  let isReady = $state(false);
  let connecting = $state(false);

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
</script>

<svelte:head>
  <title>Welcome — Cascade</title>
</svelte:head>

<main class="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6">
  <div class="max-w-md w-full text-center space-y-8">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold text-white">Welcome back</h1>
      <p class="text-neutral-400 text-sm">Connect your Nostr identity to start trading.</p>
    </div>

    <div class="space-y-3">
      <button
        onclick={handleConnect}
        disabled={connecting}
        class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors"
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>

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
