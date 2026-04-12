<script lang="ts">
  interface Props {
    pending: boolean;
    secretKey?: string;
    onLogin?: () => void | Promise<void>;
  }

  let { pending, secretKey = $bindable(''), onLogin }: Props = $props();
</script>

<div class="stack">
  <label class="field">
    <span class="muted">Account key</span>
    <textarea bind:value={secretKey} placeholder="Paste your account key"></textarea>
  </label>
  <button
    class="button auth-action"
    type="button"
    onclick={() => void onLogin?.()}
    disabled={pending || !secretKey.trim()}
  >
    {pending ? 'Signing in...' : 'Continue with key'}
  </button>
</div>
