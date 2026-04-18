<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Trigger
  > = $props();
</script>

<NavigationMenuPrimitive.Trigger
  {...restProps}
  class={cn(
    'inline-flex items-center gap-2 rounded-none px-0 py-2 text-sm font-medium text-base-content/50 hover:bg-transparent hover:text-white data-[state=open]:text-white focus-visible:outline-none',
    className
  )}
>
  <span>
    {@render children?.()}
  </span>
  <svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" />
  </svg>
</NavigationMenuPrimitive.Trigger>
