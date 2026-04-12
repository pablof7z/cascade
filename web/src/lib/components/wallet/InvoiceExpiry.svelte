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
  <span class="wallet-expiry-expired">Expired</span>
{:else}
  <div class="wallet-expiry">
    <span>Expires in</span>
    <strong>{formatted}</strong>
  </div>
{/if}

<style>
  .wallet-expiry {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-faint);
    font-size: 0.76rem;
  }

  .wallet-expiry strong {
    color: var(--text);
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .wallet-expiry-expired {
    color: var(--negative);
    font-size: 0.76rem;
  }
</style>
