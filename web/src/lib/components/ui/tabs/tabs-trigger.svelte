<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.Trigger
  > = $props();
</script>

<TabsPrimitive.Trigger {...restProps} class={cn('tabs-trigger', className)}>
  {@render children?.()}
</TabsPrimitive.Trigger>
