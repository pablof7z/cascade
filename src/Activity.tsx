import { useState } from 'react'
import { Link } from 'react-router-dom'

type ActivityFilter = 'All' | 'Trades' | 'New Markets' | 'Resolutions'
type ActivityType = 'trade' | 'new_market' | 'resolution'

interface ActivityItem {
  id: string
  type: ActivityType
  timestamp: Date
  actor: string
  actorNpub: string
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
      actorNpub: 'npub1qrs...def',
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
      actorNpub: 'npub1abc...xyz',
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
      actorNpub: 'npub1xyz...abc',
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
      actorNpub: 'npub1sys...tem',
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
      actorNpub: 'npub1mno...pqr',
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
      actorNpub: 'npub1def...ghi',
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
      actorNpub: 'npub1ghi...jkl',
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
      actorNpub: 'npub1sys...tem',
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
      actorNpub: 'npub1jkl...mno',
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
      actorNpub: 'npub1pqr...stu',
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
    <div className="shell shell-page">
      <div className="page-header">
        <h1>Activity</h1>
        <p className="page-subtitle">Recent activity across all markets</p>
      </div>

      {/* Filter tabs */}
      <div className="page-tabs">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`page-tab ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Activity feed */}
      <div className="activity-feed">
        {filteredActivity.map((item) => (
          <div key={item.id} className={`activity-item activity-${item.type}`}>
            <div className="activity-icon">{getActivityIcon(item.type)}</div>
            <div className="activity-content">
              <div className="activity-header">
                <span className="activity-actor">{item.actor}</span>
                <code className="activity-npub">{item.actorNpub}</code>
                <span className="activity-time">{formatTimestamp(item.timestamp)}</span>
              </div>
              <div className="activity-action">
                <span className="action-text">{item.action}</span>
                {item.details && <span className="action-details">{item.details}</span>}
              </div>
              <Link
                to={item.marketType === 'thesis' ? `/thesis/${item.marketId}` : `/market/${item.marketId}`}
                className="activity-market"
              >
                <span className={`market-type-badge ${item.marketType}`}>{item.marketType}</span>
                <span className="market-name">{item.marketName}</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
