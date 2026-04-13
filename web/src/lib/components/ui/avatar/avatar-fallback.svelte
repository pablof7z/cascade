<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof AvatarPrimitive.Fallback
  > = $props();
</script>

<AvatarPrimitive.Fallback
  {...restProps}
  class={cn('flex size-full items-center justify-center font-semibold leading-none', className)}
>
  {@render children?.()}
</AvatarPrimitive.Fallback>
