import { useState } from 'react'
import { Link } from 'react-router-dom'

type ProfileTab = 'Positions' | 'Created Modules' | 'Created Theses'

interface UserPosition {
  id: string
  name: string
  type: 'module' | 'thesis'
  side: 'YES' | 'NO'
  pnl: number
}

interface CreatedMarket {
  id: string
  title: string
  type: 'module' | 'thesis'
  totalVolume: number
  traders: number
}

// Mock data
const mockPositions: UserPosition[] = [
  { id: '1', name: 'AGI achieved by 2030', type: 'module', side: 'YES', pnl: 80 },
  { id: '2', name: 'First Mars landing with crew by 2035', type: 'module', side: 'NO', pnl: -15 },
  { id: '3', name: 'The Great Decoupling', type: 'thesis', side: 'YES', pnl: 52.5 },
]

const mockCreatedModules: CreatedMarket[] = [
  { id: '10', title: 'Brain-computer interface reaches 1M users', type: 'module', totalVolume: 2450, traders: 28 },
  { id: '11', title: 'Lab-grown meat exceeds 10% market share', type: 'module', totalVolume: 1820, traders: 19 },
]

const mockCreatedTheses: CreatedMarket[] = [
  { id: '20', title: 'Biological longevity escape velocity achieved', type: 'thesis', totalVolume: 5200, traders: 42 },
]

const tabs: ProfileTab[] = ['Positions', 'Created Modules', 'Created Theses']

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Positions')

  // Mock user stats
  const userStats = {
    npub: 'npub1abc...xyz',
    totalTrades: 47,
    winRate: 68.5,
    totalPnl: 1250.75,
    reputationScore: 842,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-neutral-400 mt-1">Your identity and trading history</p>
      </div>

      {/* Nostr identity section */}
      <div className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg mb-6">
        <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center text-2xl">
          👤
        </div>
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Nostr Identity</span>
          <code className="block text-white font-mono mt-1">{userStats.npub}</code>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Total Trades</span>
          <span className="block text-xl font-bold text-white mt-1">{userStats.totalTrades}</span>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Win Rate</span>
          <span className="block text-xl font-bold text-white mt-1">{userStats.winRate}%</span>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Total P&L</span>
          <span className={`block text-xl font-bold mt-1 ${userStats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(userStats.totalPnl)}
          </span>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Reputation</span>
          <span className="block text-xl font-bold text-white mt-1">{userStats.reputationScore}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Positions' && (
          <div className="space-y-2">
            {mockPositions.map((pos) => (
              <Link
                key={pos.id}
                to={pos.type === 'thesis' ? `/thesis/${pos.id}` : `/market/${pos.id}`}
                className="flex items-center gap-3 p-3 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors"
              >
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  pos.type === 'thesis' ? 'bg-neutral-700/50 text-neutral-300' : 'bg-neutral-700/50 text-neutral-300'
                }`}>
                  {pos.type}
                </span>
                <span className="flex-1 text-white text-sm">{pos.name}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  pos.side === 'YES' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                }`}>
                  {pos.side}
                </span>
                <span className={`text-sm font-medium ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(pos.pnl)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'Created Modules' && (
          <div className="space-y-3">
            {mockCreatedModules.map((market) => (
              <Link
                key={market.id}
                to={`/market/${market.id}`}
                className="block p-4 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors"
              >
                <h3 className="text-white font-medium mb-2">{market.title}</h3>
                <div className="flex gap-4 text-sm text-neutral-400">
                  <span>Volume: {formatCurrency(market.totalVolume)}</span>
                  <span>{market.traders} traders</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'Created Theses' && (
          <div className="space-y-3">
            {mockCreatedTheses.map((market) => (
              <Link
                key={market.id}
                to={`/thesis/${market.id}`}
                className="block p-4 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors"
              >
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-amber-900/50 text-amber-300 mb-2">
                  Thesis
                </span>
                <h3 className="text-white font-medium mb-2">{market.title}</h3>
                <div className="flex gap-4 text-sm text-neutral-400">
                  <span>Volume: {formatCurrency(market.totalVolume)}</span>
                  <span>{market.traders} traders</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
