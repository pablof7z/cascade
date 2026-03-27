import { useState } from 'react'

type LeaderboardTab = 'Top Predictors' | 'Top Creators' | 'Most Accurate'
type TimeFilter = 'All Time' | 'This Month' | 'This Week'

interface LeaderboardEntry {
  rank: number
  displayName: string
  descriptor: string
  stat1: number
  stat1Label: string
  stat2: number
  stat2Label: string
}

// Mock data generators
function generatePredictors(): LeaderboardEntry[] {
  return [
    { rank: 1, displayName: 'futurist_alice', descriptor: 'AI timelines', stat1: 8420, stat1Label: 'Total P&L', stat2: 156, stat2Label: 'Trades' },
    { rank: 2, displayName: 'oracle_bob', descriptor: 'Macro catalysts', stat1: 6250, stat1Label: 'Total P&L', stat2: 98, stat2Label: 'Trades' },
    { rank: 3, displayName: 'sigma_trader', descriptor: 'Energy & climate', stat1: 5180, stat1Label: 'Total P&L', stat2: 203, stat2Label: 'Trades' },
    { rank: 4, displayName: 'cascader_99', descriptor: 'Signal hunter', stat1: 4720, stat1Label: 'Total P&L', stat2: 87, stat2Label: 'Trades' },
    { rank: 5, displayName: 'ai_believer', descriptor: 'Labs & benchmarks', stat1: 3950, stat1Label: 'Total P&L', stat2: 142, stat2Label: 'Trades' },
    { rank: 6, displayName: 'space_hodler', descriptor: 'Launch & defense', stat1: 3420, stat1Label: 'Total P&L', stat2: 65, stat2Label: 'Trades' },
    { rank: 7, displayName: 'climate_prophet', descriptor: 'Policy watcher', stat1: 2890, stat1Label: 'Total P&L', stat2: 78, stat2Label: 'Trades' },
    { rank: 8, displayName: 'tech_oracle', descriptor: 'Frontier theses', stat1: 2450, stat1Label: 'Total P&L', stat2: 112, stat2Label: 'Trades' },
  ]
}

function generateCreators(): LeaderboardEntry[] {
  return [
    { rank: 1, displayName: 'market_maker_1', descriptor: 'Creates thin, arguable modules', stat1: 42, stat1Label: 'Markets', stat2: 125000, stat2Label: 'Volume' },
    { rank: 2, displayName: 'thesis_builder', descriptor: 'Bundles modules into theses', stat1: 28, stat1Label: 'Markets', stat2: 89000, stat2Label: 'Volume' },
    { rank: 3, displayName: 'future_shaper', descriptor: 'Seeds debates early', stat1: 24, stat1Label: 'Markets', stat2: 67500, stat2Label: 'Volume' },
    { rank: 4, displayName: 'module_master', descriptor: 'Resolution criteria specialist', stat1: 19, stat1Label: 'Markets', stat2: 54200, stat2Label: 'Volume' },
    { rank: 5, displayName: 'cascade_pro', descriptor: 'Rotates liquidity aggressively', stat1: 15, stat1Label: 'Markets', stat2: 41800, stat2Label: 'Volume' },
  ]
}

function generateAccurate(): LeaderboardEntry[] {
  return [
    { rank: 1, displayName: 'calibrated_cal', descriptor: 'High-conviction closer', stat1: 94.2, stat1Label: 'Accuracy %', stat2: 52, stat2Label: 'Resolved' },
    { rank: 2, displayName: 'precise_pat', descriptor: 'Event-chain mapper', stat1: 91.8, stat1Label: 'Accuracy %', stat2: 38, stat2Label: 'Resolved' },
    { rank: 3, displayName: 'truth_seeker', descriptor: 'Counter-consensus specialist', stat1: 89.5, stat1Label: 'Accuracy %', stat2: 67, stat2Label: 'Resolved' },
    { rank: 4, displayName: 'bayesian_bob', descriptor: 'Belief updater', stat1: 87.3, stat1Label: 'Accuracy %', stat2: 44, stat2Label: 'Resolved' },
    { rank: 5, displayName: 'signal_finder', descriptor: 'Catalyst watcher', stat1: 85.1, stat1Label: 'Accuracy %', stat2: 29, stat2Label: 'Resolved' },
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

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-black'
    if (rank === 2) return 'bg-neutral-400 text-black'
    if (rank === 3) return 'bg-amber-700 text-white'
    return 'bg-neutral-700 text-neutral-300'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-neutral-400 mt-1">Top performers on Cascade</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-neutral-800 p-1 rounded-lg">
        {leaderboardTabs.map((tab) => (
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

      {/* Time filter */}
      <div className="flex gap-2 mb-6">
        {timeFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              timeFilter === filter
                ? 'bg-neutral-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
            onClick={() => setTimeFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankStyle(entry.rank)}`}>
              {entry.rank}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-white font-medium">{entry.displayName}</span>
              <span className="text-xs text-neutral-500">{entry.descriptor}</span>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <span className="block text-white font-medium">{formatStat(entry.stat1, entry.stat1Label)}</span>
                <span className="text-xs text-neutral-500">{entry.stat1Label}</span>
              </div>
              <div className="text-right">
                <span className="block text-white font-medium">{formatStat(entry.stat2, entry.stat2Label)}</span>
                <span className="text-xs text-neutral-500">{entry.stat2Label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
