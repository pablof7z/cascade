<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.Trigger
  > = $props();
</script>

<TabsPrimitive.Trigger
  {...restProps}
  class={cn(
    'tab h-auto flex-none rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium text-base-content/50 hover:text-base-content/80 focus-visible:outline-none data-[state=active]:tab-active data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-white',
    className
  )}
>
  {@render children?.()}
</TabsPrimitive.Trigger>
