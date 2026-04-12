<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogContentProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogContentProps = $props();
</script>

<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay class="dialog-overlay" />
  <DialogPrimitive.Content {...restProps} class={cn('dialog-content', className)}>
    {@render children?.()}
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
