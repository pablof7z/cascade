<script lang="ts">
  let { text, label = 'Copy' }: { text: string; label?: string } = $props();
  let copied = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      if (timeoutId) clearTimeout(timeoutId);
      copied = true;
      timeoutId = setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      // Ignore clipboard failures.
    }
  }
</script>

<button class="wallet-copy-button" onclick={handleCopy} type="button">
  {copied ? 'Copied' : label}
</button>

<style>
  .wallet-copy-button {
    border: 0;
    background: transparent;
    color: var(--text-faint);
    font-size: 0.76rem;
    cursor: pointer;
  }

  .wallet-copy-button:hover {
    color: var(--text);
  }
</style>
