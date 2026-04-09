<script lang="ts">
  interface Props {
    amount: number
    fee: number
    destination: string
    destinationType: 'bolt11' | 'lightning_address'
    onConfirm: () => void
    onCancel: () => void
  }

  let { amount, fee, destination, destinationType, onConfirm, onCancel }: Props = $props()

  const total = $derived(amount + fee)

  function truncateDestination(dest: string, type: 'bolt11' | 'lightning_address'): string {
    if (type === 'bolt11') {
      return dest.length > 40 ? dest.slice(0, 40) + '...' : dest
    }
    return dest
  }
</script>

<div class="bg-neutral-900 border border-neutral-800 p-5">
  <div class="space-y-4 mb-6">
    <div>
      <p class="text-xs text-neutral-500 uppercase mb-1">Amount</p>
      <p class="text-2xl font-mono font-medium text-white">{amount.toLocaleString()} sats</p>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-xs text-neutral-500">Network fee</span>
      <span class="text-sm font-mono text-neutral-400">~{fee.toLocaleString()} sats</span>
    </div>

    <div class="flex items-center justify-between pt-3 border-t border-neutral-800">
      <span class="text-xs text-neutral-500">Total deducted</span>
      <span class="text-lg font-mono font-medium text-white">{total.toLocaleString()} sats</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-xs text-neutral-500">Destination</span>
      <span class="text-xs font-mono text-neutral-400">{truncateDestination(destination, destinationType)}</span>
    </div>
  </div>

  <div class="flex gap-3">
    <button
      type="button"
      onclick={onCancel}
      class="flex-1 px-4 py-2 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={onConfirm}
      class="flex-1 px-4 py-2 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
    >
      Confirm withdrawal
    </button>
  </div>
</div>
