// ─── Activity Feed Page ───────────────────────────────────────────────────────
// Chronological stream of everything happening across the user's workspace —
// agent actions, meeting entries, proposals, position changes, and source adds.
// All data is mock; a subtle "Sample activity" label is shown.

import { useMemo, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Field = 'AI & Semiconductors' | 'Energy Transition' | 'Global Shipping'
type AgentName = 'Orion' | 'Vesper' | 'Meridian' | 'Solace' | 'Flux'
type EntryType = 'Meeting' | 'Proposal' | 'Position' | 'Source' | 'System'

interface ActivityEntry {
  id: string
  /** Unix timestamp (ms) */
  ts: number
  agent: AgentName | 'System'
  field: Field | null
  type: EntryType
  action: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

// Anchor: "now" is Mar 31 2026, ~10:00 UTC
const NOW = new Date('2026-03-31T10:00:00Z').getTime()
const minsAgo = (m: number) => NOW - m * 60_000
const hoursAgo = (h: number) => NOW - h * 3_600_000

const ENTRIES: ActivityEntry[] = [
  {
    id: 'e01',
    ts: minsAgo(8),
    agent: 'Orion',
    field: 'AI & Semiconductors',
    type: 'Source',
    action: 'added source: Reuters — "TSMC sees record AI chip orders for Q2 ahead of earnings"',
  },
  {
    id: 'e02',
    ts: minsAgo(21),
    agent: 'Vesper',
    field: 'AI & Semiconductors',
    type: 'Proposal',
    action: 'proposed LONG position on NVDA options spread — target $0.78, size $4,200',
  },
  {
    id: 'e03',
    ts: minsAgo(34),
    agent: 'Orion',
    field: 'AI & Semiconductors',
    type: 'Meeting',
    action: 'cited new EU AI Act enforcement guidance in AI & Semiconductors weekly sync',
  },
  {
    id: 'e04',
    ts: minsAgo(47),
    agent: 'Flux',
    field: 'Energy Transition',
    type: 'Position',
    action: 'closed SHORT on EU Carbon Credits — exit at $0.61, realised P&L −$304',
  },
  {
    id: 'e05',
    ts: minsAgo(59),
    agent: 'Solace',
    field: 'Energy Transition',
    type: 'Meeting',
    action: 'flagged revised IEA offshore wind projections as a key thesis risk in meeting notes',
  },
  {
    id: 'e06',
    ts: hoursAgo(1) + minsAgo(-22) * 0,
    agent: 'Meridian',
    field: 'AI & Semiconductors',
    type: 'Source',
    action: 'added source: Bloomberg — "ASML warns on EUV order softness in H2 2026"',
  },
  {
    id: 'e07',
    ts: hoursAgo(2),
    agent: 'Vesper',
    field: 'AI & Semiconductors',
    type: 'Proposal',
    action: 'proposed SHORT on ASML EUV Orders Q3 Miss — probability revised to 61%, size $3,800',
  },
  {
    id: 'e08',
    ts: hoursAgo(3),
    agent: 'Solace',
    field: 'Energy Transition',
    type: 'Position',
    action: 'opened LONG on Offshore Wind GW Target Met 2025 — entry $0.44, size $6,300',
  },
  {
    id: 'e09',
    ts: hoursAgo(4),
    agent: 'Orion',
    field: 'Global Shipping',
    type: 'Meeting',
    action: 'presented Baltic Dry Index Q3 thesis — noted Panama Canal congestion as tailwind',
  },
  {
    id: 'e10',
    ts: hoursAgo(6),
    agent: 'Flux',
    field: 'Global Shipping',
    type: 'Source',
    action: 'added source: Drewry Container Index — week ending Mar 28 (−3.2% WoW)',
  },
  {
    id: 'e11',
    ts: hoursAgo(9),
    agent: 'Meridian',
    field: 'AI & Semiconductors',
    type: 'Proposal',
    action: 'proposed reducing TSMC LONG size from $9,200 to $8,400 — confidence unchanged',
  },
  {
    id: 'e12',
    ts: hoursAgo(12),
    agent: 'System',
    field: null,
    type: 'System',
    action: 'scheduled rebalancing run completed — 3 positions adjusted, 0 alerts triggered',
  },
  {
    id: 'e13',
    ts: hoursAgo(16),
    agent: 'Solace',
    field: 'Energy Transition',
    type: 'Source',
    action: 'added source: Carbon Pulse — "EU ETS allowances hit 3-month low on mild winter demand"',
  },
  {
    id: 'e14',
    ts: hoursAgo(20),
    agent: 'Orion',
    field: 'AI & Semiconductors',
    type: 'Meeting',
    action: 'opened new meeting: Nvidia Blackwell supply chain review — 4 sources attached',
  },
  {
    id: 'e15',
    ts: hoursAgo(24),
    agent: 'Vesper',
    field: 'AI & Semiconductors',
    type: 'Position',
    action: 'increased SHORT on Nvidia Blackwell Delay — size raised to $5,200, entry avg $0.38',
  },
  {
    id: 'e16',
    ts: hoursAgo(28),
    agent: 'Flux',
    field: 'Energy Transition',
    type: 'Meeting',
    action: 'cited LNG spot price spike risk in Energy Transition Q2 outlook — assigned HIGH severity',
  },
  {
    id: 'e17',
    ts: hoursAgo(33),
    agent: 'Meridian',
    field: 'Global Shipping',
    type: 'Proposal',
    action: 'proposed SHORT on Panama Canal Delay — thesis: low-water season ends May 2026',
  },
  {
    id: 'e18',
    ts: hoursAgo(40),
    agent: 'System',
    field: null,
    type: 'System',
    action: 'weekly treasury snapshot saved — total capital $113,520, deployed ratio 77.4%',
  },
  {
    id: 'e19',
    ts: hoursAgo(44),
    agent: 'Solace',
    field: 'Energy Transition',
    type: 'Position',
    action: 'trimmed LONG on LNG Spot Price Spike — size reduced to $4,200, P&L −$126 YTD',
  },
  {
    id: 'e20',
    ts: hoursAgo(48),
    agent: 'Orion',
    field: 'Global Shipping',
    type: 'Source',
    action: 'added source: BIMCO — "Container demand recovery may stall on Red Sea rerouting costs"',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diffMs = NOW - ts
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return 'Yesterday'
}

// Agent initials — 2 chars
function initials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Stable avatar color per agent name
const AGENT_COLORS: Record<string, string> = {
  Orion:   'bg-violet-900 text-violet-300',
  Vesper:  'bg-sky-900 text-sky-300',
  Meridian:'bg-amber-900 text-amber-300',
  Solace:  'bg-emerald-900 text-emerald-300',
  Flux:    'bg-rose-900 text-rose-300',
  System:  'bg-neutral-800 text-neutral-400',
}

function agentColorClass(name: string): string {
  return AGENT_COLORS[name] ?? 'bg-neutral-800 text-neutral-400'
}

// Type badge styles
const TYPE_STYLES: Record<EntryType, string> = {
  Meeting:  'border-sky-800 text-sky-400',
  Proposal: 'border-violet-800 text-violet-400',
  Position: 'border-emerald-800 text-emerald-400',
  Source:   'border-amber-800 text-amber-400',
  System:   'border-neutral-700 text-neutral-500',
}

// ─── Filter State ─────────────────────────────────────────────────────────────

const ALL_FIELDS: Array<Field | 'All'> = [
  'All',
  'AI & Semiconductors',
  'Energy Transition',
  'Global Shipping',
]

const ALL_AGENTS: Array<AgentName | 'All'> = [
  'All', 'Orion', 'Vesper', 'Meridian', 'Solace', 'Flux',
]

const ALL_TYPES: Array<EntryType | 'All'> = [
  'All', 'Meeting', 'Proposal', 'Position', 'Source', 'System',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs px-2 py-1 focus:outline-none focus:border-neutral-600 cursor-pointer"
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function AgentAvatar({ name }: { name: string }) {
  return (
    <div
      className={`w-7 h-7 shrink-0 flex items-center justify-center text-xs font-semibold ${agentColorClass(name)}`}
    >
      {initials(name)}
    </div>
  )
}

function TypeBadge({ type }: { type: EntryType }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-xs border ${TYPE_STYLES[type]}`}
    >
      {type}
    </span>
  )
}

function FieldChip({ field }: { field: Field }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-xs border border-neutral-700 text-neutral-500">
      {field}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityFeed() {
  const [fieldFilter, setFieldFilter] = useState<Field | 'All'>('All')
  const [agentFilter, setAgentFilter] = useState<AgentName | 'All'>('All')
  const [typeFilter, setTypeFilter]   = useState<EntryType | 'All'>('All')

  const filtered = useMemo(() => {
    return ENTRIES.filter(e => {
      if (fieldFilter !== 'All' && e.field !== fieldFilter) return false
      if (agentFilter !== 'All' && e.agent !== agentFilter) return false
      if (typeFilter !== 'All' && e.type !== typeFilter) return false
      return true
    })
  }, [fieldFilter, agentFilter, typeFilter])

  return (
    <div className="p-8 space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Activity</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Everything happening across your workspace, most recent first.
          </p>
        </div>
        <span className="text-xs text-neutral-600 mt-1">Sample activity</span>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-800 pb-5">
        <FilterDropdown
          label="Field"
          options={ALL_FIELDS}
          value={fieldFilter}
          onChange={setFieldFilter}
        />
        <FilterDropdown
          label="Agent"
          options={ALL_AGENTS}
          value={agentFilter}
          onChange={setAgentFilter}
        />
        <FilterDropdown
          label="Type"
          options={ALL_TYPES}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        {(fieldFilter !== 'All' || agentFilter !== 'All' || typeFilter !== 'All') && (
          <button
            onClick={() => {
              setFieldFilter('All')
              setAgentFilter('All')
              setTypeFilter('All')
            }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-neutral-600">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* ── Activity stream ── */}
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-600 py-8 text-center">
          No activity matches the current filters.
        </p>
      ) : (
        <div className="divide-y divide-neutral-800">
          {filtered.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 py-3.5">

              {/* Avatar */}
              <AgentAvatar name={entry.agent} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-sm font-medium text-white">
                    {entry.agent}
                  </span>
                  <span className="text-sm text-neutral-400">
                    {entry.action}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {entry.field && <FieldChip field={entry.field} />}
                  <TypeBadge type={entry.type} />
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-neutral-600 shrink-0 pt-0.5 tabular-nums">
                {relativeTime(entry.ts)}
              </span>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}
