<script lang="ts">
  let { text, label = 'Copy' }: { text: string; label?: string } = $props();
  let copied = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    return () => clearTimeout(timeoutId);
  });

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

<button class="border-0 bg-transparent text-base-content/50 text-xs cursor-pointer hover:text-base-content transition-colors" onclick={handleCopy} type="button">
  {copied ? 'Copied' : label}
</button>
