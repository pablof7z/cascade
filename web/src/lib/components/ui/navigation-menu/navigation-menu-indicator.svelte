<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Indicator
  > = $props();
</script>

<NavigationMenuPrimitive.Indicator {...restProps} class={cn('flex justify-center py-1', className)}>
  {#if children}
    {@render children()}
  {:else}
    <div class="size-2 rotate-45 border border-base-300 bg-base-200"></div>
  {/if}
</NavigationMenuPrimitive.Indicator>
