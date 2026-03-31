import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import { useBookmarks } from './useBookmarks'


type LeaderboardTab = 'Top Predictors' | 'Top Creators' | 'Most Accurate' | 'Most Bookmarked'
type TimeFilter = 'All Time' | 'This Month' | 'This Week'

interface LeaderboardEntry {
  rank: number
  pubkey: string
  displayName: string
  descriptor: string
  stat1: number
  stat1Label: string
  stat2: number
  stat2Label: string
  marketId?: string
}

// Mock data generators
function generatePredictors(): LeaderboardEntry[] {
  return [
    { rank: 1, pubkey: 'mock_lb_01000000000000000000000000000000000000000000000000000001', displayName: 'futurist_alice', descriptor: 'AI timelines', stat1: 8420, stat1Label: 'Total P&L', stat2: 156, stat2Label: 'Trades' },
    { rank: 2, pubkey: 'mock_lb_02000000000000000000000000000000000000000000000000000002', displayName: 'oracle_bob', descriptor: 'Macro catalysts', stat1: 6250, stat1Label: 'Total P&L', stat2: 98, stat2Label: 'Trades' },
    { rank: 3, pubkey: 'mock_lb_03000000000000000000000000000000000000000000000000000003', displayName: 'sigma_trader', descriptor: 'Energy & climate', stat1: 5180, stat1Label: 'Total P&L', stat2: 203, stat2Label: 'Trades' },
    { rank: 4, pubkey: 'mock_lb_04000000000000000000000000000000000000000000000000000004', displayName: 'cascader_99', descriptor: 'Signal hunter', stat1: 4720, stat1Label: 'Total P&L', stat2: 87, stat2Label: 'Trades' },
    { rank: 5, pubkey: 'mock_lb_05000000000000000000000000000000000000000000000000000005', displayName: 'ai_believer', descriptor: 'Labs & benchmarks', stat1: 3950, stat1Label: 'Total P&L', stat2: 142, stat2Label: 'Trades' },
    { rank: 6, pubkey: 'mock_lb_06000000000000000000000000000000000000000000000000000006', displayName: 'space_hodler', descriptor: 'Launch & defense', stat1: 3420, stat1Label: 'Total P&L', stat2: 65, stat2Label: 'Trades' },
    { rank: 7, pubkey: 'mock_lb_07000000000000000000000000000000000000000000000000000007', displayName: 'climate_prophet', descriptor: 'Policy watcher', stat1: 2890, stat1Label: 'Total P&L', stat2: 78, stat2Label: 'Trades' },
    { rank: 8, pubkey: 'mock_lb_08000000000000000000000000000000000000000000000000000008', displayName: 'tech_oracle', descriptor: 'Frontier theses', stat1: 2450, stat1Label: 'Total P&L', stat2: 112, stat2Label: 'Trades' },
  ]
}

function generateCreators(): LeaderboardEntry[] {
  return [
    { rank: 1, pubkey: 'mock_lb_09000000000000000000000000000000000000000000000000000009', displayName: 'market_maker_1', descriptor: 'Creates thin, arguable modules', stat1: 42, stat1Label: 'Markets', stat2: 125000, stat2Label: 'Volume' },
    { rank: 2, pubkey: 'mock_lb_10000000000000000000000000000000000000000000000000000010', displayName: 'thesis_builder', descriptor: 'Bundles modules into theses', stat1: 28, stat1Label: 'Markets', stat2: 89000, stat2Label: 'Volume' },
    { rank: 3, pubkey: 'mock_lb_11000000000000000000000000000000000000000000000000000011', displayName: 'future_shaper', descriptor: 'Seeds debates early', stat1: 24, stat1Label: 'Markets', stat2: 67500, stat2Label: 'Volume' },
    { rank: 4, pubkey: 'mock_lb_12000000000000000000000000000000000000000000000000000012', displayName: 'module_master', descriptor: 'Resolution criteria specialist', stat1: 19, stat1Label: 'Markets', stat2: 54200, stat2Label: 'Volume' },
    { rank: 5, pubkey: 'mock_lb_13000000000000000000000000000000000000000000000000000013', displayName: 'cascade_pro', descriptor: 'Rotates liquidity aggressively', stat1: 15, stat1Label: 'Markets', stat2: 41800, stat2Label: 'Volume' },
  ]
}

function generateAccurate(): LeaderboardEntry[] {
  return [
    { rank: 1, pubkey: 'mock_lb_14000000000000000000000000000000000000000000000000000014', displayName: 'calibrated_cal', descriptor: 'High-conviction closer', stat1: 94.2, stat1Label: 'Accuracy %', stat2: 52, stat2Label: 'Resolved' },
    { rank: 2, pubkey: 'mock_lb_15000000000000000000000000000000000000000000000000000015', displayName: 'precise_pat', descriptor: 'Event-chain mapper', stat1: 91.8, stat1Label: 'Accuracy %', stat2: 38, stat2Label: 'Resolved' },
    { rank: 3, pubkey: 'mock_lb_16000000000000000000000000000000000000000000000000000016', displayName: 'truth_seeker', descriptor: 'Counter-consensus specialist', stat1: 89.5, stat1Label: 'Accuracy %', stat2: 67, stat2Label: 'Resolved' },
    { rank: 4, pubkey: 'mock_lb_17000000000000000000000000000000000000000000000000000017', displayName: 'bayesian_bob', descriptor: 'Belief updater', stat1: 87.3, stat1Label: 'Accuracy %', stat2: 44, stat2Label: 'Resolved' },
    { rank: 5, pubkey: 'mock_lb_18000000000000000000000000000000000000000000000000000018', displayName: 'signal_finder', descriptor: 'Catalyst watcher', stat1: 85.1, stat1Label: 'Accuracy %', stat2: 29, stat2Label: 'Resolved' },
  ]
}

const leaderboardTabs: LeaderboardTab[] = ['Top Predictors', 'Top Creators', 'Most Accurate', 'Most Bookmarked']
const timeFilters: TimeFilter[] = ['All Time', 'This Month', 'This Week']

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatStat(value: number, label: string): string {
  if (label === 'Total P&L' || label === 'Volume') {
    return `${currencyFormatter.format(value)}`
  }
  if (label === 'Accuracy %' || label === 'Yes %') {
    return `${value.toFixed(1)}%`
  }
  if (label === 'Bookmarks') {
    return value.toString()
  }
  return value.toString()
}

interface LeaderboardProps {
  markets?: Record<string, MarketEntry>
}

export default function Leaderboard({ markets = {} }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('Top Predictors')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('All Time')

  const marketIds = useMemo(() => Object.keys(markets), [markets])
  const { getTopBookmarked } = useBookmarks(marketIds)

  const getEntries = (): LeaderboardEntry[] => {
    switch (activeTab) {
      case 'Top Predictors':
        return generatePredictors()
      case 'Top Creators':
        return generateCreators()
      case 'Most Accurate':
        return generateAccurate()
      case 'Most Bookmarked':
        return getTopBookmarked(10).map((item, i) => {
          const market = markets[item.marketId]?.market
          return {
            rank: i + 1,
            pubkey: `mock_pubkey_${i + 1}`,
            displayName: market?.title ?? item.marketId.slice(0, 12) + '…',
            descriptor: market?.description?.slice(0, 60) || 'Prediction market',
            stat1: item.count,
            stat1Label: 'Bookmarks',
            stat2: market ? Math.round((market.qLong / (market.qLong + market.qShort)) * 100) : 0,
            stat2Label: 'Yes %',
            marketId: item.marketId,
          }
        })
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
        <p className="text-neutral-400 mt-1">Top performers on Contrarian</p>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-neutral-800 mb-4">
        {leaderboardTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? '-mb-px border-b-2 border-white text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Time filter */}
      <div className="flex items-center gap-1 mb-6">
        {timeFilters.map((filter, i) => (
          <span key={filter} className="flex items-center">
            {i > 0 && <span className="text-neutral-600 mx-1">·</span>}
            <button
              type="button"
              className={`text-sm transition-colors ${
                timeFilter === filter
                  ? 'text-white font-medium'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              onClick={() => setTimeFilter(filter)}
            >
              {filter}
            </button>
          </span>
        ))}
      </div>

      {/* Leaderboard list */}
      <div className="space-y-2">
        {entries.length === 0 && activeTab === 'Most Bookmarked' && (
          <p className="text-neutral-500 text-sm py-8 text-center">
            No bookmarked markets yet. Bookmark markets to see them ranked here.
          </p>
        )}
        {entries.map((entry) => {
          const content = (
            <>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getRankStyle(entry.rank)}`}>
                {entry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-white font-medium truncate">{entry.displayName}</span>
                <span className="text-xs text-neutral-500 truncate block">{entry.descriptor}</span>
              </div>
              <div className="flex gap-6 shrink-0">
                <div className="text-right">
                  <span className="block text-white font-medium">{formatStat(entry.stat1, entry.stat1Label)}</span>
                  <span className="text-xs text-neutral-500">{entry.stat1Label}</span>
                </div>
                <div className="text-right">
                  <span className="block text-white font-medium">{formatStat(entry.stat2, entry.stat2Label)}</span>
                  <span className="text-xs text-neutral-500">{entry.stat2Label}</span>
                </div>
              </div>
            </>
          )

          return entry.marketId ? (
            <Link
              key={entry.rank}
              to={`/market/${entry.marketId}`}
              className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-600 hover:bg-neutral-750 transition-colors"
            >
              {content}
            </Link>
          ) : (
            <div
              key={entry.rank}
              className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg"
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
