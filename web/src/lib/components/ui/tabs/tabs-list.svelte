<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.List
  > = $props();
</script>

<TabsPrimitive.List {...restProps} class={cn('tabs-list', className)}>
  {@render children?.()}
</TabsPrimitive.List>

<style>
  :global(.tabs-list) {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    border-radius: 0.6rem;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    padding: 0.2rem;
  }
</style>
