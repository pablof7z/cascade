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
      // silent
    }
  }
</script>

<button onclick={handleCopy} class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
  {copied ? 'Copied!' : label}
</button>
