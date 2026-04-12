<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.Content
  > = $props();
</script>

<TabsPrimitive.Content {...restProps} class={cn('tabs-content', className)}>
  {@render children?.()}
</TabsPrimitive.Content>
