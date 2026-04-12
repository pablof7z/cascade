<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Indicator
  > = $props();
</script>

<NavigationMenuPrimitive.Indicator {...restProps} class={cn('nav-menu-indicator', className)}>
  {#if children}
    {@render children()}
  {:else}
    <div class="nav-menu-indicator-tip"></div>
  {/if}
</NavigationMenuPrimitive.Indicator>
