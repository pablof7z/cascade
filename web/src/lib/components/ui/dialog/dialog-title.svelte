<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogTitleProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogTitleProps = $props();
</script>

<DialogPrimitive.Title {...restProps} class={cn('dialog-title', className)}>
  {@render children?.()}
</DialogPrimitive.Title>
