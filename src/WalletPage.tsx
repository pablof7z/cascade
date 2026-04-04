import { useEffect } from 'react'
import Wallet from './components/Wallet'
import { loadOrCreateVault } from './vaultStore'

export default function WalletPage() {
  useEffect(() => {
    loadOrCreateVault().catch((err: unknown) => {
      console.error('[vault] Initialization error:', err)
    })
  }, [])

  return (
    <div className="min-h-[80vh] bg-neutral-950 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Your Wallet</h1>
        <Wallet />
      </div>
    </div>
  )
}
