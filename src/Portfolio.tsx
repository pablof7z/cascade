import { useState } from 'react'
import { Link } from 'react-router-dom'

type PositionType = 'module' | 'thesis'
type PositionSide = 'YES' | 'NO'

interface Position {
  id: string
  marketName: string
  type: PositionType
  side: PositionSide
  amount: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

// Mock positions data
const mockModulePositions: Position[] = [
  {
    id: '1',
    marketName: 'AGI achieved by 2030',
    type: 'module',
    side: 'YES',
    amount: 500,
    avgPrice: 0.42,
    currentPrice: 0.58,
    pnl: 80,
    pnlPercent: 38.1,
  },
  {
    id: '2',
    marketName: 'First Mars landing with crew by 2035',
    type: 'module',
    side: 'NO',
    amount: 250,
    avgPrice: 0.65,
    currentPrice: 0.71,
    pnl: -15,
    pnlPercent: -6.0,
  },
  {
    id: '3',
    marketName: 'Fusion power plant goes online',
    type: 'module',
    side: 'YES',
    amount: 300,
    avgPrice: 0.35,
    currentPrice: 0.41,
    pnl: 18,
    pnlPercent: 17.1,
  },
]

const mockThesisPositions: Position[] = [
  {
    id: '4',
    marketName: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth',
    type: 'thesis',
    side: 'YES',
    amount: 750,
    avgPrice: 0.55,
    currentPrice: 0.62,
    pnl: 52.5,
    pnlPercent: 12.7,
  },
  {
    id: '5',
    marketName: 'Space economy exceeds $1T by 2040',
    type: 'thesis',
    side: 'YES',
    amount: 400,
    avgPrice: 0.48,
    currentPrice: 0.52,
    pnl: 16,
    pnlPercent: 8.3,
  },
]

const tabs = ['Module Positions', 'Thesis Positions'] as const
type Tab = typeof tabs[number]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<Tab>('Module Positions')

  const allPositions = [...mockModulePositions, ...mockThesisPositions]
  const totalInvested = allPositions.reduce((sum, p) => sum + p.amount, 0)
  const totalPnl = allPositions.reduce((sum, p) => sum + p.pnl, 0)
  const currentValue = totalInvested + totalPnl
  const totalPnlPercent = (totalPnl / totalInvested) * 100

  const positions = activeTab === 'Module Positions' ? mockModulePositions : mockThesisPositions

  return (
    <div className="shell shell-page">
      <div className="page-header">
        <h1>Portfolio</h1>
        <p className="page-subtitle">Track your positions and performance</p>
      </div>

      {/* Summary stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Invested</span>
          <span className="stat-value">{formatCurrency(totalInvested)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current Value</span>
          <span className="stat-value">{formatCurrency(currentValue)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total P&L</span>
          <span className={`stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(totalPnl)} ({formatPercent(totalPnlPercent)})
          </span>
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
            <span className="tab-count">
              {tab === 'Module Positions' ? mockModulePositions.length : mockThesisPositions.length}
            </span>
          </button>
        ))}
      </div>

      {/* Position cards */}
      <div className="positions-list">
        {positions.map((position) => (
          <Link
            key={position.id}
            to={position.type === 'thesis' ? `/thesis/${position.id}` : `/market/${position.id}`}
            className="position-card"
          >
            <div className="position-header">
              <span className={`position-badge ${position.type}`}>{position.type}</span>
              <span className={`position-side ${position.side.toLowerCase()}`}>{position.side}</span>
            </div>
            <h3 className="position-title">{position.marketName}</h3>
            <div className="position-details">
              <div className="position-detail">
                <span className="detail-label">Amount</span>
                <span className="detail-value">{formatCurrency(position.amount)}</span>
              </div>
              <div className="position-detail">
                <span className="detail-label">Avg Price</span>
                <span className="detail-value">{(position.avgPrice * 100).toFixed(0)}¢</span>
              </div>
              <div className="position-detail">
                <span className="detail-label">Current</span>
                <span className="detail-value">{(position.currentPrice * 100).toFixed(0)}¢</span>
              </div>
              <div className="position-detail">
                <span className="detail-label">P&L</span>
                <span className={`detail-value ${position.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
