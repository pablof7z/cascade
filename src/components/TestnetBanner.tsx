import { useTestnet, TESTNET_LABELS } from '../testnetConfig'

/**
 * Persistent banner indicating paper trading mode.
 * Click to toggle between testnet and mainnet.
 */
export default function TestnetBanner() {
  const { isTestnet, toggle } = useTestnet()

  if (!isTestnet) return null

  return (
    <button
      onClick={toggle}
      className="w-full bg-neutral-800 text-neutral-200 text-center py-1.5 px-4 text-sm font-semibold hover:bg-neutral-700 transition-colors cursor-pointer"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-neutral-600 rounded-full animate-pulse" />
        {TESTNET_LABELS.label} Mode — {TESTNET_LABELS.description}
        <span className="text-xs opacity-75">(click to switch to mainnet)</span>
      </span>
    </button>
  )
}
