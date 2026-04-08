<script lang="ts">
  import { goto } from '$app/navigation';
  import { nostrStore } from '$lib/stores/nostr';

  let pubkey = $derived(nostrStore.get().pubkey);

  $effect(() => {
    if (pubkey) {
      goto(`/profile/${pubkey}`, { replaceState: true });
    }
  });
</script>

<svelte:head>
  <title>Profile | Cascade</title>
</svelte:head>

<div class="flex flex-col items-center justify-center min-h-[60vh] px-4">
  <div class="text-center max-w-md">
    <h1 class="text-2xl font-medium text-white mb-4">
      Sign in to view your profile
    </h1>
    <p class="text-neutral-400 mb-8">
      Connect with your identity to access your profile and trading history.
    </p>
    <a
      href="/join"
      class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
    >
      Get Started
    </a>
  </div>
</div>