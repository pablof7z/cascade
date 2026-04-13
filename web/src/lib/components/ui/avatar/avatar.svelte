<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof AvatarPrimitive.Root
  > = $props();
</script>

<AvatarPrimitive.Root
  {...restProps}
  class={cn('avatar inline-flex shrink-0 overflow-hidden rounded-md bg-base-300 text-white', className)}
>
  {@render children?.()}
</AvatarPrimitive.Root>
