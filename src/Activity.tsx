import { useState } from 'react'
import { Link } from 'react-router-dom'

type ActivityFilter = 'All' | 'Trades' | 'New Markets' | 'Resolutions'
type ActivityType = 'trade' | 'new_market' | 'resolution'

interface ActivityItem {
  id: string
  type: ActivityType
  timestamp: Date
  actor: string
  actorDescriptor: string
  action: string
  marketId: string
  marketName: string
  marketType: 'module' | 'thesis'
  details?: string
}

// Generate mock activity data
function generateMockActivity(): ActivityItem[] {
  const now = Date.now()
  const minute = 60 * 1000
  const hour = 60 * minute

  return [
    {
      id: '1',
      type: 'trade',
      timestamp: new Date(now - 2 * minute),
      actor: 'futurist_alice',
      actorDescriptor: 'AI timelines',
      action: 'bought YES',
      marketId: '1',
      marketName: 'AGI achieved by 2030',
      marketType: 'module',
      details: '$250 @ 58¢',
    },
    {
      id: '2',
      type: 'new_market',
      timestamp: new Date(now - 15 * minute),
      actor: 'thesis_builder',
      actorDescriptor: 'Thesis builder',
      action: 'created thesis',
      marketId: '20',
      marketName: 'The Great Decoupling',
      marketType: 'thesis',
    },
    {
      id: '3',
      type: 'trade',
      timestamp: new Date(now - 32 * minute),
      actor: 'oracle_bob',
      actorDescriptor: 'Macro catalysts',
      action: 'sold NO',
      marketId: '2',
      marketName: 'First Mars landing by 2035',
      marketType: 'module',
      details: '$180 @ 29¢',
    },
    {
      id: '4',
      type: 'resolution',
      timestamp: new Date(now - 1 * hour),
      actor: 'system',
      actorDescriptor: 'Settlement engine',
      action: 'resolved YES',
      marketId: '5',
      marketName: 'GPT-5 released in 2024',
      marketType: 'module',
    },
    {
      id: '5',
      type: 'trade',
      timestamp: new Date(now - 1.5 * hour),
      actor: 'sigma_trader',
      actorDescriptor: 'Energy & climate',
      action: 'bought YES',
      marketId: '3',
      marketName: 'Fusion power plant goes online',
      marketType: 'module',
      details: '$500 @ 41¢',
    },
    {
      id: '6',
      type: 'new_market',
      timestamp: new Date(now - 2 * hour),
      actor: 'future_shaper',
      actorDescriptor: 'New market scout',
      action: 'created module',
      marketId: '10',
      marketName: 'Neuralink FDA approval by 2026',
      marketType: 'module',
    },
    {
      id: '7',
      type: 'trade',
      timestamp: new Date(now - 3 * hour),
      actor: 'ai_believer',
      actorDescriptor: 'Labs & benchmarks',
      action: 'bought NO',
      marketId: '20',
      marketName: 'The Great Decoupling',
      marketType: 'thesis',
      details: '$320 @ 38¢',
    },
    {
      id: '8',
      type: 'resolution',
      timestamp: new Date(now - 4 * hour),
      actor: 'system',
      actorDescriptor: 'Settlement engine',
      action: 'resolved NO',
      marketId: '8',
      marketName: 'Bitcoin hits $200k in 2025',
      marketType: 'module',
    },
    {
      id: '9',
      type: 'trade',
      timestamp: new Date(now - 5 * hour),
      actor: 'space_hodler',
      actorDescriptor: 'Launch & defense',
      action: 'bought YES',
      marketId: '21',
      marketName: 'Space economy exceeds $1T by 2040',
      marketType: 'thesis',
      details: '$750 @ 52¢',
    },
    {
      id: '10',
      type: 'new_market',
      timestamp: new Date(now - 6 * hour),
      actor: 'market_maker_1',
      actorDescriptor: 'Liquidity strategist',
      action: 'created module',
      marketId: '11',
      marketName: 'Commercial quantum computer by 2028',
      marketType: 'module',
    },
  ]
}

const filters: ActivityFilter[] = ['All', 'Trades', 'New Markets', 'Resolutions']

function formatTimestamp(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}

function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'trade':
      return '💱'
    case 'new_market':
      return '🆕'
    case 'resolution':
      return '✅'
  }
}

export default function Activity() {
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All')

  const allActivity = generateMockActivity()

  const filteredActivity = allActivity.filter((item) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Trades') return item.type === 'trade'
    if (activeFilter === 'New Markets') return item.type === 'new_market'
    if (activeFilter === 'Resolutions') return item.type === 'resolution'
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity</h1>
        <p className="text-neutral-400 mt-1">Recent activity across all markets</p>
      </div>

      {/* Filter tabs */}
      <nav className="flex gap-1 border-b border-neutral-800 mb-6">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeFilter === filter
                ? '-mb-px border-b-2 border-white text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </nav>

      {/* Activity feed */}
      <div className="space-y-3">
        {filteredActivity.map((item) => (
          <div
            key={item.id}
            className="flex gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg"
          >
            <div className="text-2xl">{getActivityIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white font-medium">{item.actor}</span>
                <span className="text-xs text-neutral-500">{item.actorDescriptor}</span>
                <span className="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-neutral-300">{item.action}</span>
                {item.details && (
                  <span className="text-neutral-500 text-sm">{item.details}</span>
                )}
              </div>
              <Link
                to={`/market/${item.marketId}`}
                className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  item.marketType === 'thesis' ? 'bg-neutral-700/50 text-neutral-300' : 'bg-neutral-700/50 text-neutral-300'
                }`}>
                  {item.marketType}
                </span>
                <span className="text-neutral-200">{item.marketName}</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
