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

  const colorClass = $derived(
    secondsLeft > 120
      ? 'text-neutral-400'
      : secondsLeft > 30
        ? 'text-amber-500'
        : 'text-rose-500'
  );

  const formatted = $derived(
    `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  );
</script>

{#if secondsLeft === 0}
  <span class="text-xs text-rose-500">Expired</span>
{:else}
  <div class="flex items-center gap-1.5">
    <span class="text-xs text-neutral-500">Expires in</span>
    <span class="text-xs font-mono {colorClass}">{formatted}</span>
  </div>
{/if}
