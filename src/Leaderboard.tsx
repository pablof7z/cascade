import { useState } from 'react'

type LeaderboardTab = 'Top Predictors' | 'Top Creators' | 'Most Accurate'
type TimeFilter = 'All Time' | 'This Month' | 'This Week'

interface LeaderboardEntry {
  rank: number
  npub: string
  displayName: string
  stat1: number
  stat1Label: string
  stat2: number
  stat2Label: string
}

// Mock data generators
function generatePredictors(): LeaderboardEntry[] {
  return [
    { rank: 1, npub: 'npub1qrs...def', displayName: 'futurist_alice', stat1: 8420, stat1Label: 'Total P&L', stat2: 156, stat2Label: 'Trades' },
    { rank: 2, npub: 'npub1abc...xyz', displayName: 'oracle_bob', stat1: 6250, stat1Label: 'Total P&L', stat2: 98, stat2Label: 'Trades' },
    { rank: 3, npub: 'npub1xyz...abc', displayName: 'sigma_trader', stat1: 5180, stat1Label: 'Total P&L', stat2: 203, stat2Label: 'Trades' },
    { rank: 4, npub: 'npub1mno...pqr', displayName: 'cascader_99', stat1: 4720, stat1Label: 'Total P&L', stat2: 87, stat2Label: 'Trades' },
    { rank: 5, npub: 'npub1def...ghi', displayName: 'ai_believer', stat1: 3950, stat1Label: 'Total P&L', stat2: 142, stat2Label: 'Trades' },
    { rank: 6, npub: 'npub1ghi...jkl', displayName: 'space_hodler', stat1: 3420, stat1Label: 'Total P&L', stat2: 65, stat2Label: 'Trades' },
    { rank: 7, npub: 'npub1jkl...mno', displayName: 'climate_prophet', stat1: 2890, stat1Label: 'Total P&L', stat2: 78, stat2Label: 'Trades' },
    { rank: 8, npub: 'npub1pqr...stu', displayName: 'tech_oracle', stat1: 2450, stat1Label: 'Total P&L', stat2: 112, stat2Label: 'Trades' },
  ]
}

function generateCreators(): LeaderboardEntry[] {
  return [
    { rank: 1, npub: 'npub1xyz...abc', displayName: 'market_maker_1', stat1: 42, stat1Label: 'Markets', stat2: 125000, stat2Label: 'Volume' },
    { rank: 2, npub: 'npub1abc...xyz', displayName: 'thesis_builder', stat1: 28, stat1Label: 'Markets', stat2: 89000, stat2Label: 'Volume' },
    { rank: 3, npub: 'npub1def...ghi', displayName: 'future_shaper', stat1: 24, stat1Label: 'Markets', stat2: 67500, stat2Label: 'Volume' },
    { rank: 4, npub: 'npub1ghi...jkl', displayName: 'module_master', stat1: 19, stat1Label: 'Markets', stat2: 54200, stat2Label: 'Volume' },
    { rank: 5, npub: 'npub1jkl...mno', displayName: 'cascade_pro', stat1: 15, stat1Label: 'Markets', stat2: 41800, stat2Label: 'Volume' },
  ]
}

function generateAccurate(): LeaderboardEntry[] {
  return [
    { rank: 1, npub: 'npub1mno...pqr', displayName: 'calibrated_cal', stat1: 94.2, stat1Label: 'Accuracy %', stat2: 52, stat2Label: 'Resolved' },
    { rank: 2, npub: 'npub1pqr...stu', displayName: 'precise_pat', stat1: 91.8, stat1Label: 'Accuracy %', stat2: 38, stat2Label: 'Resolved' },
    { rank: 3, npub: 'npub1stu...vwx', displayName: 'truth_seeker', stat1: 89.5, stat1Label: 'Accuracy %', stat2: 67, stat2Label: 'Resolved' },
    { rank: 4, npub: 'npub1vwx...yza', displayName: 'bayesian_bob', stat1: 87.3, stat1Label: 'Accuracy %', stat2: 44, stat2Label: 'Resolved' },
    { rank: 5, npub: 'npub1yza...bcd', displayName: 'signal_finder', stat1: 85.1, stat1Label: 'Accuracy %', stat2: 29, stat2Label: 'Resolved' },
  ]
}

const leaderboardTabs: LeaderboardTab[] = ['Top Predictors', 'Top Creators', 'Most Accurate']
const timeFilters: TimeFilter[] = ['All Time', 'This Month', 'This Week']

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatStat(value: number, label: string): string {
  if (label === 'Total P&L' || label === 'Volume') {
    return `$${currencyFormatter.format(value)}`
  }
  if (label === 'Accuracy %') {
    return `${value.toFixed(1)}%`
  }
  return value.toString()
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('Top Predictors')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('All Time')

  const getEntries = (): LeaderboardEntry[] => {
    switch (activeTab) {
      case 'Top Predictors':
        return generatePredictors()
      case 'Top Creators':
        return generateCreators()
      case 'Most Accurate':
        return generateAccurate()
    }
  }

  const entries = getEntries()

  return (
    <div className="shell shell-page">
      <div className="page-header">
        <h1>Leaderboard</h1>
        <p className="page-subtitle">Top performers on Cascade</p>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        {leaderboardTabs.map((tab) => (
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

      {/* Time filter */}
      <div className="time-filters">
        {timeFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`time-filter ${timeFilter === filter ? 'active' : ''}`}
            onClick={() => setTimeFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      <div className="leaderboard-list">
        {entries.map((entry) => (
          <div key={entry.rank} className="leaderboard-row">
            <div className="leaderboard-rank">
              <span className={`rank-number rank-${entry.rank <= 3 ? entry.rank : 'other'}`}>
                {entry.rank}
              </span>
            </div>
            <div className="leaderboard-user">
              <span className="user-name">{entry.displayName}</span>
              <code className="user-npub">{entry.npub}</code>
            </div>
            <div className="leaderboard-stats">
              <div className="leaderboard-stat">
                <span className="stat-value">{formatStat(entry.stat1, entry.stat1Label)}</span>
                <span className="stat-label">{entry.stat1Label}</span>
              </div>
              <div className="leaderboard-stat">
                <span className="stat-value">{formatStat(entry.stat2, entry.stat2Label)}</span>
                <span className="stat-label">{entry.stat2Label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
