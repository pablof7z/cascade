<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Content
  > = $props();
</script>

<NavigationMenuPrimitive.Content {...restProps} class={cn('nav-menu-content', className)}>
  {@render children?.()}
</NavigationMenuPrimitive.Content>
