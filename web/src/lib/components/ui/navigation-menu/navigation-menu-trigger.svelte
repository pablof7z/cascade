<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Trigger
  > = $props();
</script>

<NavigationMenuPrimitive.Trigger {...restProps} class={cn('nav-menu-trigger', className)}>
  <span class="nav-menu-trigger-label">
    {@render children?.()}
  </span>
  <svg class="nav-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
</NavigationMenuPrimitive.Trigger>
