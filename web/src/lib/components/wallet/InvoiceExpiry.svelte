<script lang="ts">
  let { expiresAt, onExpired }: { expiresAt: number; onExpired?: () => void } = $props();

  let secondsLeft = $state(0);

  $effect(() => {
    secondsLeft = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

    const interval = setInterval(() => {
      secondsLeft = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
      if (secondsLeft === 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  const formatted = $derived(
    `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  );
</script>

{#if secondsLeft === 0}
  <span class="text-error text-xs">Expired</span>
{:else}
  <div class="flex items-center gap-1 text-base-content/50 text-xs">
    <span>Expires in</span>
    <strong class="text-base-content font-mono font-medium">{formatted}</strong>
  </div>
{/if}
