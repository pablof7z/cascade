<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  interface Props {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class={cn('flex justify-end gap-2 border-t border-neutral-800 px-5 py-4', className)}>
  {@render children?.()}
</div>
