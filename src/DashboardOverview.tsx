import { Link } from 'react-router-dom'

// ─── Mock data ─────────────────────────────────────────────────────────────

const DEMO_ACTION_QUEUE = [
  {
    id: '1',
    type: 'counter-evidence' as const,
    fieldId: 'ai-semis',
    field: 'AI & Semiconductors',
    description: 'Orion surfaced an EU regulatory draft that may undercut your export timeline thesis',
    agent: 'Orion',
    time: '2h ago',
  },
  {
    id: '2',
    type: 'proposal' as const,
    fieldId: 'energy',
    field: 'Energy Transition',
    description: 'Vesper proposed LONG lithium futures — awaiting your approval',
    agent: 'Vesper',
    time: '4h ago',
  },
  {
    id: '3',
    type: 'question' as const,
    fieldId: 'shipping',
    field: 'Global Shipping',
    description: 'Meridian and Solace are split on container rate normalization — need your read to break the tie',
    agent: 'Meridian',
    time: '6h ago',
  },
]

const DEMO_FIELDS = [
  {
    id: 'ai-semis',
    name: 'AI & Semiconductors',
    tone: 'rose' as const,
    statusLine: 'Agents are pushing back on your take on EU chip export timeline',
    agents: 3,
    markets: 4,
    capital: '$52,400',
  },
  {
    id: 'energy',
    name: 'Energy Transition',
    tone: 'emerald' as const,
    statusLine: 'New enforcement data confirms your read on lithium supply constraints',
    agents: 2,
    markets: 3,
    capital: '$34,200',
  },
  {
    id: 'shipping',
    name: 'Global Shipping',
    tone: 'neutral' as const,
    statusLine: 'Agents are monitoring. No new contradictions found.',
    agents: 2,
    markets: 2,
    capital: '$18,720',
  },
]

const DEMO_ACTIVITY = [
  { time: '10m ago', agent: 'Orion',   initials: 'OR', color: 'bg-sky-600',    action: 'cited new EU regulatory draft on chip controls',          field: 'AI & Semis' },
  { time: '35m ago', agent: 'Vesper',  initials: 'VE', color: 'bg-violet-600', action: 'proposed LONG position on lithium futures',                field: 'Energy'     },
  { time: '1h ago',  agent: 'You',     initials: 'YO', color: 'bg-neutral-600',action: 'reviewed counter-evidence and updated EU timeline stance',  field: 'AI & Semis' },
  { time: '2h ago',  agent: 'Meridian',initials: 'ME', color: 'bg-amber-600',  action: 'challenged container rate forecast in meeting',            field: 'Shipping'   },
  { time: '3h ago',  agent: 'Solace',  initials: 'SO', color: 'bg-emerald-600',action: 'added source: Bloomberg analysis on TSMC capex cuts',      field: 'AI & Semis' },
  { time: '5h ago',  agent: 'Flux',    initials: 'FL', color: 'bg-rose-600',   action: 'opened SHORT position on Maersk Q3 guidance',             field: 'Shipping'   },
  { time: '8h ago',  agent: 'Vesper',  initials: 'VE', color: 'bg-violet-600', action: 'found contradictory IEA report on battery demand forecasts',field: 'Energy'    },
]

// ─── Type constants ─────────────────────────────────────────────────────────

const ACTION_TYPE_STYLES = {
  'counter-evidence': {
    label: 'Counter-evidence',
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  },
  proposal: {
    label: 'Proposal',
    badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  },
  question: {
    label: 'Question',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
}

const FIELD_STATUS_LINE_STYLES = {
  rose:    'text-rose-400',
  emerald: 'text-emerald-400',
  neutral: 'text-neutral-500',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AllClearBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-neutral-800 text-neutral-500 text-sm">
      <span className="text-emerald-500">✓</span>
      No items need your input right now. Agents are working.
    </div>
  )
}

type ActionItem = typeof DEMO_ACTION_QUEUE[number]

function ActionQueueItem({ item, isDemo }: { item: ActionItem; isDemo: boolean }) {
  const styles = ACTION_TYPE_STYLES[item.type]
  return (
    <Link
      to={`/dashboard/field/${item.fieldId}`}
      className="flex items-start gap-4 px-4 py-3 hover:bg-neutral-900 transition-colors group"
    >
      <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded-sm font-medium ${styles.badge}`}>
        {styles.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs text-neutral-500">{item.field}</span>
        </div>
        <p className="text-sm text-neutral-300 leading-snug">{item.description}</p>
        <p className="text-xs text-neutral-600 mt-1">
          {item.agent} · {item.time}
          {isDemo && <span className="ml-2 text-neutral-700">Preview</span>}
        </p>
      </div>
      <span className="text-xs text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0 mt-0.5">
        →
      </span>
    </Link>
  )
}

type FieldItem = typeof DEMO_FIELDS[number]

function FieldCard({ field, isDemo }: { field: FieldItem; isDemo: boolean }) {
  const statusLineColor = FIELD_STATUS_LINE_STYLES[field.tone]
  return (
    <Link
      to={`/dashboard/field/${field.id}`}
      className="block bg-neutral-900 border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-white font-medium text-sm">{field.name}</span>
        {isDemo && (
          <span className="shrink-0 text-xs text-neutral-600 border border-neutral-800 px-1.5 py-0.5">
            Preview
          </span>
        )}
      </div>
      <p className={`text-sm italic leading-snug ${statusLineColor}`}>{field.statusLine}</p>
      <p className="text-xs text-neutral-500 mt-3">
        {field.agents} agents · {field.markets} markets · {field.capital}
      </p>
    </Link>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DashboardOverview() {
  // In production this would come from real data; for now always show demo
  const hasFields = false
  const actionQueue = DEMO_ACTION_QUEUE
  const fields = DEMO_FIELDS
  const activity = DEMO_ACTIVITY
  const isDemo = !hasFields

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Briefing headline */}
      <div>
        <h1 className="font-heading text-2xl text-white leading-tight">
          Your agents worked overnight.
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          {fields.length} field{fields.length !== 1 ? 's' : ''} active
          {actionQueue.length > 0 ? ` · ${actionQueue.length} item${actionQueue.length !== 1 ? 's' : ''} need your input` : ''}
        </p>
      </div>

      {/* Needs Your Input */}
      <section>
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Needs Your Input
        </h2>
        {actionQueue.length > 0 ? (
          <div className="border border-neutral-800 divide-y divide-neutral-800">
            {actionQueue.map(item => (
              <ActionQueueItem key={item.id} item={item} isDemo={isDemo} />
            ))}
          </div>
        ) : (
          <AllClearBanner />
        )}
      </section>

      {/* Your Fields */}
      <section>
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Your Fields
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fields.map(field => (
            <FieldCard key={field.id} field={field} isDemo={isDemo} />
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Recent Activity
        </h2>
        <div className="divide-y divide-neutral-800">
          {activity.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div
                className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
              >
                {item.initials}
              </div>
              <span className="text-xs font-medium text-neutral-400 w-16 shrink-0">{item.agent}</span>
              <p className="text-sm text-neutral-400 flex-1">{item.action}</p>
              <span className="text-xs text-neutral-600 bg-neutral-900 border border-neutral-800 px-2 py-0.5 shrink-0">
                {item.field}
              </span>
              <span className="text-xs text-neutral-600 w-16 text-right shrink-0 font-mono">{item.time}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
