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
    <div className="shell shell-page">
      <div className="page-header">
        <h1>Profile</h1>
        <p className="page-subtitle">Your identity and trading history</p>
      </div>

      {/* Nostr identity section */}
      <div className="identity-card">
        <div className="identity-avatar">
          <div className="avatar-placeholder">👤</div>
        </div>
        <div className="identity-info">
          <span className="identity-label">Nostr Identity</span>
          <code className="identity-npub">{userStats.npub}</code>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Trades</span>
          <span className="stat-value">{userStats.totalTrades}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Win Rate</span>
          <span className="stat-value">{userStats.winRate}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total P&L</span>
          <span className={`stat-value ${userStats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(userStats.totalPnl)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reputation</span>
          <span className="stat-value">{userStats.reputationScore}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`page-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'Positions' && (
          <div className="positions-list compact">
            {mockPositions.map((pos) => (
              <Link
                key={pos.id}
                to={pos.type === 'thesis' ? `/thesis/${pos.id}` : `/market/${pos.id}`}
                className="position-row"
              >
                <span className={`position-badge ${pos.type}`}>{pos.type}</span>
                <span className="position-name">{pos.name}</span>
                <span className={`position-side ${pos.side.toLowerCase()}`}>{pos.side}</span>
                <span className={`position-pnl ${pos.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(pos.pnl)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'Created Modules' && (
          <div className="created-list">
            {mockCreatedModules.map((market) => (
              <Link key={market.id} to={`/market/${market.id}`} className="created-card">
                <h3 className="created-title">{market.title}</h3>
                <div className="created-meta">
                  <span>Volume: {formatCurrency(market.totalVolume)}</span>
                  <span>{market.traders} traders</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'Created Theses' && (
          <div className="created-list">
            {mockCreatedTheses.map((market) => (
              <Link key={market.id} to={`/thesis/${market.id}`} className="created-card">
                <span className="card-type-badge thesis-badge">Thesis</span>
                <h3 className="created-title">{market.title}</h3>
                <div className="created-meta">
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
