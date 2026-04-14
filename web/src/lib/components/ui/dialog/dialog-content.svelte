<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogContentProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogContentProps = $props();
</script>

<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay class="modal-backdrop fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
  <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <DialogPrimitive.Content
      {...restProps}
      class={cn(
        'pointer-events-auto modal-box relative w-full max-w-xl border border-neutral-800 bg-base-200 p-0 shadow-none',
        className
      )}
    >
      {@render children?.()}
    </DialogPrimitive.Content>
  </div>
</DialogPrimitive.Portal>
