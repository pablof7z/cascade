<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  interface Props extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
    inset?: boolean;
  }

  let { class: className = '', children, inset = false, ...restProps }: Props = $props();
</script>

<DropdownMenuPrimitive.Item
  {...restProps}
  class={cn(
    'menu-item flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-base-content/80 outline-none transition hover:bg-base-300 hover:text-white data-[highlighted]:bg-base-300 data-[highlighted]:text-white data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
    inset && 'pl-10',
    className
  )}
>
  {@render children?.()}
</DropdownMenuPrimitive.Item>
