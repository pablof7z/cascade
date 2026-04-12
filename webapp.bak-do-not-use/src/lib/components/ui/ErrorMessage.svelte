<script lang="ts">
  interface Props {
    error: string;
  }

  let { error }: Props = $props();
</script>

<div class="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30">
  <svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <p class="text-sm text-rose-400">{error}</p>
</div>
