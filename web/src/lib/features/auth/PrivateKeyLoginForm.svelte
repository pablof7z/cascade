<script lang="ts">
  interface Props {
    pending: boolean;
    secretKey?: string;
    onLogin?: () => void | Promise<void>;
  }

  let { pending, secretKey = $bindable(''), onLogin }: Props = $props();
</script>

<div class="grid gap-3">
  <label class="grid gap-2">
    <span class="text-xs font-medium tracking-[0.08em] text-base-content/50 uppercase">Recovery key</span>
    <textarea
      class="textarea textarea-bordered min-h-32"
      bind:value={secretKey}
      placeholder="Paste your recovery key"
    ></textarea>
  </label>
  <button
    class="btn btn-primary w-full justify-center"
    type="button"
    onclick={() => void onLogin?.()}
    disabled={pending || !secretKey.trim()}
  >
    {pending ? 'Signing in...' : 'Continue with recovery key'}
  </button>
</div>
