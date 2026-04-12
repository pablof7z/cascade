<script lang="ts">
  interface Props {
    hasExtension: boolean;
    pending: boolean;
    onLogin?: () => void | Promise<void>;
  }

  let { hasExtension, pending, onLogin }: Props = $props();
</script>

<div class="stack">
  <p class="muted" style="margin: 0;">Use a browser extension you already trust.</p>
  <button
    class="button auth-action"
    type="button"
    onclick={() => void onLogin?.()}
    disabled={pending || !hasExtension}
  >
    {pending ? 'Connecting...' : 'Continue with extension'}
  </button>
</div>
