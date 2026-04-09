<script lang="ts">
  interface Props {
    amount: number
    mintUrl: string
    onConfirm: () => void
    onCancel: () => void
  }

  let { amount, mintUrl, onConfirm, onCancel }: Props = $props()

  function formatSats(n: number): string {
    return n.toLocaleString()
  }

  function shortenMintUrl(url: string): string {
    try {
      const u = new URL(url)
      return u.host
    } catch {
      return url
    }
  }
</script>

<div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
  <h2 class="text-lg font-medium text-white mb-1">Confirm deposit</h2>
  <p class="text-neutral-400 text-sm mb-6">Review the details before creating your Lightning invoice.</p>

  <div class="space-y-3 mb-6">
    <div class="flex items-center justify-between py-2 border-b border-neutral-800">
      <span class="text-sm text-neutral-400">Amount</span>
      <span class="text-sm font-mono font-medium text-white">{formatSats(amount)} sats</span>
    </div>
    <div class="flex items-center justify-between py-2">
      <span class="text-sm text-neutral-400">Mint</span>
      <span class="text-sm font-mono text-neutral-300">{shortenMintUrl(mintUrl)}</span>
    </div>
  </div>

  <div class="flex gap-3">
    <button
      onclick={onCancel}
      class="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
    >
      Cancel
    </button>
    <button
      onclick={onConfirm}
      class="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 transition-colors"
    >
      Confirm deposit
    </button>
  </div>
</div>
