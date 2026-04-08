<script lang="ts">
  interface Props {
    status: 'pending' | 'processing' | 'complete' | 'failed'
    amount: number
    fee: number | null
    error: string | null
    preimage?: string
    onretry?: () => void
  }

  let { status, amount, fee, error, preimage, onretry }: Props = $props()

  function truncatePreimage(p: string): string {
    return p.length > 20 ? p.slice(0, 10) + '...' + p.slice(-10) : p
  }
</script>

<div class="bg-neutral-900 border border-neutral-800 p-4">
  {#if status === 'pending'}
    <p class="text-sm text-neutral-400 animate-pulse">Preparing withdrawal...</p>

  {:else if status === 'processing'}
    <p class="text-sm text-neutral-300 animate-pulse">Melting tokens...</p>

  {:else if status === 'complete'}
    <div class="space-y-1">
      <p class="text-sm font-medium text-emerald-400">Withdrawn {amount.toLocaleString()} sats</p>
      <p class="text-xs text-neutral-400">Fee paid: ~{fee?.toLocaleString() ?? '?'} sats</p>
      {#if preimage}
        <p class="text-xs font-mono text-neutral-500">Preimage: {truncatePreimage(preimage)}</p>
      {/if}
    </div>

  {:else if status === 'failed'}
    <div class="space-y-2">
      <p class="text-sm font-medium text-rose-400">Withdrawal failed</p>
      {#if error}
        <p class="text-sm text-rose-300">{error}</p>
      {/if}
      {#if onretry}
        <button
          onclick={onretry}
          class="mt-1 px-3 py-1.5 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
        >
          Try again
        </button>
      {/if}
    </div>
  {/if}
</div>
