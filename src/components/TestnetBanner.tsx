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
      className="w-full bg-amber-500 text-amber-950 text-center py-1.5 px-4 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-amber-950 rounded-full animate-pulse" />
        {TESTNET_LABELS.label} Mode — {TESTNET_LABELS.description}
        <span className="text-xs opacity-75">(click to switch to mainnet)</span>
      </span>
    </button>
  )
}
