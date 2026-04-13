<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.List
  > = $props();
</script>

<TabsPrimitive.List
  {...restProps}
  class={cn('tabs tabs-bordered w-full justify-start gap-4 border-b border-neutral-800 bg-transparent p-0', className)}
>
  {@render children?.()}
</TabsPrimitive.List>
