<script lang="ts">
  import { isTestnet, toggle, TESTNET_LABELS } from '$lib/stores/testnet';

  let testnetValue = $state(false);

  $effect(() => {
    testnetValue = isTestnet();
  });
</script>

{#if testnetValue}
  <button
    onclick={toggle}
    class="w-full bg-neutral-800 text-neutral-200 text-center py-1.5 px-4 text-sm font-semibold hover:bg-neutral-700 transition-colors cursor-pointer"
  >
    <span class="inline-flex items-center gap-2">
      <span class="inline-block w-2 h-2 bg-neutral-600 rounded-full animate-pulse" />
      {TESTNET_LABELS.label} Mode — {TESTNET_LABELS.description}
      <span class="text-xs opacity-75">(click to switch to mainnet)</span>
    </span>
  </button>
{/if}
