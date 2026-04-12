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
