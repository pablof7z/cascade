<script lang="ts">
  import NavHeader from '$lib/components/NavHeader.svelte';
  import ThesisBuilder from '$lib/components/ThesisBuilder.svelte';
  import { nostrStore } from '$lib/stores/nostr';

  let pubkey = $state<string | null>(null);

  $effect(() => {
    pubkey = nostrStore.get().pubkey;
  });
</script>

<svelte:head>
  <title>Create Market | Cascade</title>
</svelte:head>

<NavHeader />

{#if !pubkey}
  <div class="max-w-2xl mx-auto px-4 py-20 text-center">
    <p class="text-neutral-400 mb-4">Sign in to create a market.</p>
    <a href="/join" class="text-white border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500">Sign in</a>
  </div>
{:else}
  <ThesisBuilder />
{/if}
