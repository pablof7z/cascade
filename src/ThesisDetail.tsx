import { useParams, Link } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import type { Dispatch } from 'react'
import { useState } from 'react'
import Discussion from './Discussion'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  return `${currencyFormatter.format(value * 100)}%`
}

// Mock supporting evidence data
interface SupportingModule {
  id: string
  title: string
  probability: number
  impact: number // percentage impact on thesis if module resolves YES
  direction: 'supports' | 'opposes'
}

const mockSupportingModules: SupportingModule[] = [
  {
    id: 'mod-1',
    title: 'AGI achieved by 2030',
    probability: 0.35,
    impact: 15,
    direction: 'supports',
  },
  {
    id: 'mod-2',
    title: 'US implements UBI pilot program',
    probability: 0.42,
    impact: 8,
    direction: 'supports',
  },
  {
    id: 'mod-3',
    title: 'Major tech company announces mass layoffs due to AI',
    probability: 0.68,
    impact: 12,
    direction: 'supports',
  },
  {
    id: 'mod-4',
    title: 'Real wages grow 2%+ annually through 2030',
    probability: 0.55,
    impact: -20,
    direction: 'opposes',
  },
]

type Props = {
  thesisId?: string // Optional - can also use useParams
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function ThesisDetail({ markets, dispatch }: Props) {
  const { id } = useParams<{ id: string }>()
  const [betSide, setBetSide] = useState<Side>('LONG')
  const [betAmount, setBetAmount] = useState('100')

  const entry = id ? markets[id] : undefined

  if (!entry) {
    return (
      <div className="shell">
        <div className="detail-not-found">
          <h2>Thesis not found</h2>
          <Link to="/" className="ghost-button">Back to markets</Link>
        </div>
      </div>
    )
  }

  const { market } = entry
  const metrics = deriveMarketMetrics(market)

  const handlePlaceBet = () => {
    const amount = Number(betAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    dispatch({
      type: 'TRADE',
      marketId: market.id,
      side: betSide,
      amount: amount,
      actor: 'you',
      kind: 'BUY',
    })
    setBetAmount('100')
  }

  return (
    <div className="shell">
      <nav className="detail-breadcrumb">
        <Link to="/">← All Markets</Link>
        <span className="breadcrumb-type">Thesis</span>
      </nav>

      <div className="dashboard">
        {/* Main content column */}
        <div className="detail-main">
          <header className="detail-header">
            <span className="detail-type-badge thesis-badge">Thesis</span>
            <h1 className="detail-title">{market.title}</h1>
            {market.description && (
              <p className="detail-description">{market.description}</p>
            )}
          </header>

          {/* Probability bar */}
          <div className="detail-probability">
            <div className="probability-header">
              <span className="probability-label">Current Probability</span>
              <span className="probability-value">{formatPercent(metrics.longPositionShare)}</span>
            </div>
            <div className="state-bar detail-bar">
              <span
                className="state-bar-long"
                style={{ width: `${metrics.longPositionShare * 100}%` }}
              />
            </div>
            <div className="probability-labels">
              <span>LONG {formatPercent(metrics.longPositionShare)}</span>
              <span>SHORT {formatPercent(metrics.shortPositionShare)}</span>
            </div>
          </div>

          {/* Supporting Evidence Section */}
          <section className="supporting-evidence">
            <h2 className="section-title">Supporting Evidence</h2>
            <p className="section-subtitle">
              Modules that influence this thesis probability
            </p>

            <div className="evidence-grid">
              {mockSupportingModules.map((mod) => (
                <div key={mod.id} className="evidence-card">
                  <div className="evidence-header">
                    <span className={`evidence-direction ${mod.direction}`}>
                      {mod.direction === 'supports' ? '↑' : '↓'}
                    </span>
                    <h3 className="evidence-title">{mod.title}</h3>
                  </div>
                  <div className="evidence-stats">
                    <div className="evidence-stat">
                      <span className="stat-label">Module Prob.</span>
                      <span className="stat-value">{formatPercent(mod.probability)}</span>
                    </div>
                    <div className="evidence-stat">
                      <span className="stat-label">Impact</span>
                      <span className={`stat-value impact-${mod.direction}`}>
                        If YES → Thesis {mod.impact > 0 ? '+' : ''}{mod.impact}%
                      </span>
                    </div>
                  </div>
                  <div className="evidence-bar">
                    <div 
                      className="evidence-bar-fill"
                      style={{ width: `${mod.probability * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Discussion */}
          <section className="detail-section">
            <Discussion />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="detail-sidebar">
          {/* Bet Panel */}
          <div className="bet-panel">
            <h3 className="bet-panel-title">Place a Bet</h3>
            
            <div className="bet-side-toggle">
              <button
                type="button"
                className={`side-button ${betSide === 'LONG' ? 'active long' : ''}`}
                onClick={() => setBetSide('LONG')}
              >
                LONG
              </button>
              <button
                type="button"
                className={`side-button ${betSide === 'SHORT' ? 'active short' : ''}`}
                onClick={() => setBetSide('SHORT')}
              >
                SHORT
              </button>
            </div>

            <label className="bet-amount-label">
              <span>Amount</span>
              <div className="bet-amount-input">
                <span className="currency-prefix">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="100"
                />
              </div>
            </label>

            <div className="bet-preview">
              <div className="preview-row">
                <span>Potential return</span>
                <span className="preview-value">
                  {formatCurrency(Number(betAmount) * (betSide === 'LONG' ? 1 / metrics.longPositionShare : 1 / metrics.shortPositionShare))}
                </span>
              </div>
              <div className="preview-row">
                <span>Current odds</span>
                <span className="preview-value">
                  {betSide === 'LONG' ? formatPercent(metrics.longPositionShare) : formatPercent(metrics.shortPositionShare)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="primary-button bet-submit"
              onClick={handlePlaceBet}
            >
              Place Bet
            </button>
          </div>

          {/* Market Stats */}
          <div className="market-stats-panel">
            <h3 className="panel-title">Market Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Reserve</span>
                <span className="stat-value">{formatCurrency(market.reserve)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Trades</span>
                <span className="stat-value">{market.quotes.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Evidence Modules</span>
                <span className="stat-value">{mockSupportingModules.length}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
