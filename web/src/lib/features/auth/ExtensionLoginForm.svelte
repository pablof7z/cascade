<script lang="ts">
  interface Props {
    hasExtension: boolean;
    pending: boolean;
    onLogin?: () => void | Promise<void>;
  }

  let { hasExtension, pending, onLogin }: Props = $props();
</script>

<div class="grid gap-3">
  <p class="text-sm leading-6 text-base-content/50">
    Use the sign-in method that is already available in this browser.
  </p>
  <button
    class="btn btn-primary w-full justify-center"
    type="button"
    onclick={() => void onLogin?.()}
    disabled={pending || !hasExtension}
  >
    {pending ? 'Connecting...' : 'Continue in this browser'}
  </button>
</div>
