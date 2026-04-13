<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  interface Props {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class={cn('dialog-footer', className)}>
  {@render children?.()}
</div>

<style>
  :global(.dialog-footer) {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.2rem;
    border-top: 1px solid var(--border-subtle);
  }
</style>
