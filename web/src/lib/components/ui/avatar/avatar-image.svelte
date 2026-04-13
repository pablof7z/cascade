<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', ...restProps }: ComponentProps<typeof AvatarPrimitive.Image> =
    $props();
</script>

<AvatarPrimitive.Image {...restProps} class={cn('size-full object-cover', className)} />
