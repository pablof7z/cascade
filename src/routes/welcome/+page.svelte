<script lang="ts">
  import { goto } from '$app/navigation';
  import { nostrStore, reconnect } from '$lib/stores/nostr';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import { onMount } from 'svelte';
  import { importPrivateKey, saveKeys } from '../../nostrKeys';

  // Subscribe to Nostr store for reactive auth state
  let pubkey = $state<string | null>(null);
  let isReady = $state(false);
  let connecting = $state(false);

  // Key import state
  let showImport = $state(false);
  let keyInput = $state('');
  let keyError = $state('');
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
    keyError = '';
    importing = true;
    try {
      const keys = importPrivateKey(keyInput);
      saveKeys(keys);
      keyInput = '';
      goto('/discuss');
    } catch (err) {
      keyError = 'Invalid private key format';
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

      {#if !showImport}
        <button
          onclick={() => { showImport = true; }}
          class="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Already have a Nostr account? Import your key
        </button>
      {:else}
        <div class="flex items-center gap-3 py-1">
          <div class="flex-1 h-px bg-neutral-800"></div>
          <span class="text-xs text-neutral-500">or</span>
          <div class="flex-1 h-px bg-neutral-800"></div>
        </div>

        <div class="space-y-2 text-left">
          <input
            type="password"
            bind:value={keyInput}
            placeholder="Private key"
            class="w-full bg-neutral-900 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
          <p class="text-xs text-neutral-500">Your 64-character private key or nsec...</p>
          {#if keyError}
            <p class="text-sm text-rose-400">{keyError}</p>
          {/if}
          <button
            onclick={handleKeyImport}
            disabled={importing || !keyInput.trim()}
            class="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? 'Importing...' : 'Import key'}
          </button>
        </div>
      {/if}

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
