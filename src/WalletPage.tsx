import Wallet from './components/Wallet'

export default function WalletPage() {
  return (
    <div className="min-h-[80vh] bg-neutral-950 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Your Wallet</h1>
        <Wallet />
      </div>
    </div>
  )
}
