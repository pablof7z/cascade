<script lang="ts">
  interface Props {
    hasExtension: boolean;
    pending: boolean;
    onLogin?: () => void | Promise<void>;
  }

  let { hasExtension, pending, onLogin }: Props = $props();
</script>

<div class="grid gap-3">
  <p class="text-sm leading-6 text-neutral-400">Use a browser extension you already trust.</p>
  <button
    class="btn btn-primary w-full justify-center"
    type="button"
    onclick={() => void onLogin?.()}
    disabled={pending || !hasExtension}
  >
    {pending ? 'Connecting...' : 'Continue with extension'}
  </button>
</div>
