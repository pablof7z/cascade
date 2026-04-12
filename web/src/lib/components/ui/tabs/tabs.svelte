<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  type Props = Omit<ComponentProps<typeof TabsPrimitive.Root>, 'value'> & {
    value?: string;
  };

  let { value = $bindable(), class: className = '', children, ...restProps }: Props = $props();
</script>

<TabsPrimitive.Root {...restProps} bind:value class={cn('tabs-root', className)}>
  {@render children?.()}
</TabsPrimitive.Root>
