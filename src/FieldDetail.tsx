import { Link, useParams, useSearchParams } from 'react-router-dom'
import { loadField } from './fieldStorage'
import type {
  Field,
  FieldAgent,
  FieldAttention,
  MeetingEntry,
  MeetingEntryKind,
  MeetingActionStatus,
} from './fieldTypes'

// ─── Formatting ──────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// ─── Agent color palette (derive from index) ────────────────────────────────

const AGENT_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  { bg: 'bg-violet-500',  text: 'text-violet-500',  border: 'border-violet-500' },
  { bg: 'bg-amber-500',   text: 'text-amber-500',   border: 'border-amber-500' },
  { bg: 'bg-sky-500',     text: 'text-sky-500',     border: 'border-sky-500' },
  { bg: 'bg-rose-500',    text: 'text-rose-500',    border: 'border-rose-500' },
  { bg: 'bg-indigo-500',  text: 'text-indigo-500',  border: 'border-indigo-500' },
]

function agentColor(index: number) {
  return AGENT_COLORS[index % AGENT_COLORS.length]
}

function getAgentIndex(field: Field, agentId: string): number {
  const idx = field.council.findIndex(a => a.id === agentId)
  return idx >= 0 ? idx : 0
}

function getAgentName(field: Field, authorId: string): string {
  if (authorId === field.owner.id) return field.owner.name
  return field.council.find(a => a.id === authorId)?.name ?? 'Unknown'
}

function getAgentRole(field: Field, authorId: string): string {
  if (authorId === field.owner.id) return field.owner.role
  return field.council.find(a => a.id === authorId)?.role ?? ''
}

function getAgentInitial(field: Field, authorId: string): string {
  const name = getAgentName(field, authorId)
  return name.charAt(0).toUpperCase()
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'meeting' | 'positions' | 'library' | 'council'

const TABS: { id: Tab; label: string }[] = [
  { id: 'meeting',   label: 'Meeting' },
  { id: 'positions', label: 'Positions' },
  { id: 'library',   label: 'Library' },
  { id: 'council',   label: 'Council' },
]

function parseTab(v: string | null): Tab {
  return TABS.find(t => t.id === v)?.id ?? 'meeting'
}

// ─── Attention badge ──────────────────────────────────────────────────────────

const attentionStyles: Record<FieldAttention, string> = {
  steady:       'text-emerald-400 bg-emerald-950 border border-emerald-800',
  review:       'text-amber-400   bg-amber-950   border border-amber-800',
  'needs-input':'text-sky-400     bg-sky-950     border border-sky-800',
}
const attentionLabel: Record<FieldAttention, string> = {
  steady:       'Steady',
  review:       'Review',
  'needs-input':'Needs input',
}

// ─── Entry kind decorations ───────────────────────────────────────────────────

const entryKindLabel: Record<MeetingEntryKind, string> = {
  argument:        'argument',
  counterargument: '↩ counter',
  evidence:        'evidence',
  decision:        'decision',
}

const entryKindStyle: Record<MeetingEntryKind, string> = {
  argument:        'text-neutral-500',
  counterargument: 'text-rose-400 font-semibold',
  evidence:        'text-sky-400',
  decision:        'text-emerald-400',
}

// ─── Action status ────────────────────────────────────────────────────────────

const actionStatusLabel: Record<MeetingActionStatus, string> = {
  'needs-human': 'Needs your approval',
  queued:        'Queued',
  approved:      'Approved',
}

const actionStatusStyle: Record<MeetingActionStatus, string> = {
  'needs-human': 'text-sky-400 bg-sky-950 border border-sky-800',
  queued:        'text-amber-400 bg-amber-950 border border-amber-800',
  approved:      'text-emerald-400 bg-emerald-950 border border-emerald-800',
}

// ─── Meeting Tab ──────────────────────────────────────────────────────────────

function MeetingEntryCard({ entry, field }: { entry: MeetingEntry; field: Field }) {
  const agentIdx = getAgentIndex(field, entry.authorId)
  const color = agentColor(agentIdx)
  const isCounter = entry.kind === 'counterargument'

  return (
    <div className={`flex gap-4 py-5 ${
      isCounter
        ? 'pl-3 border-l-2 border-rose-700 bg-rose-950/20 -mx-6 px-6'
        : ''
    }`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full ${color.bg} flex items-center justify-center text-xs font-bold text-white`}>
        {getAgentInitial(field, entry.authorId)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Identity + timestamp row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">
            {getAgentName(field, entry.authorId)}
          </span>
          <span className="text-xs text-neutral-500">
            {getAgentRole(field, entry.authorId)}
          </span>
          <span className={`text-xs ${entryKindStyle[entry.kind]}`}>
            {entryKindLabel[entry.kind]}
          </span>
          <span className="text-xs text-neutral-600 ml-auto">{entry.at}</span>
        </div>

        {entry.headline && (
          <p className="mt-1.5 text-sm font-medium text-neutral-200">{entry.headline}</p>
        )}
        <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">{entry.body}</p>

        {/* Source citations — prominent, not an afterthought */}
        {entry.citations && entry.citations.length > 0 && (
          <div className="mt-3">
            <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">Sources</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.citations.map((c, i) => {
                const src = field.sourceLibrary.find(s => s.id === c.sourceId)
                return (
                  <span
                    key={i}
                    title={c.note}
                    className="text-xs bg-neutral-900 border border-neutral-700 px-2 py-0.5 rounded-sm text-neutral-400 hover:border-neutral-500 transition-colors cursor-default"
                  >
                    {src ? `${src.author}, ${src.addedAt.slice(0, 4)}` : c.sourceId}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingTab({ field }: { field: Field }) {
  const actions = field.meeting.actions
  const hasEntries = field.meeting.entries.length > 0
  const hasActions = actions.length > 0
  const noMeeting = !hasEntries && !hasActions

  return (
    <div className="max-w-3xl">
      {/* Meeting header */}
      <div className="mb-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-white">{field.meeting.title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-sm ${
            field.meeting.status === 'live'
              ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
              : field.meeting.status === 'awaiting-human'
                ? 'text-sky-400 bg-sky-950 border border-sky-800'
                : 'text-neutral-500 bg-neutral-800 border border-neutral-700'
          }`}>
            {field.meeting.status === 'live' ? 'Live' : field.meeting.status === 'awaiting-human' ? 'Awaiting you' : 'Watching'}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{field.meeting.summary}</p>

        {field.meeting.tensions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {field.meeting.tensions.map((t, i) => (
              <span key={i} className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-sm">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Empty state — no meeting in progress */}
      {noMeeting && (
        <div className="py-16 text-center border border-neutral-800 bg-neutral-900">
          <p className="text-sm font-medium text-neutral-400 mb-1">No meeting in progress</p>
          <p className="text-xs text-neutral-600 mb-6">Agents haven't started deliberating on this field yet.</p>
          <button
            type="button"
            className="text-sm font-medium text-white bg-neutral-800 border border-neutral-700 hover:border-neutral-500 px-4 py-2 rounded-sm transition-colors"
          >
            Start deliberation
          </button>
        </div>
      )}

      {/* Action proposals — action cards, visually distinct from discussion */}
      {hasActions && (
        <div className="mb-8 space-y-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Action proposals</p>
          {actions.map(action => {
            const ownerName = getAgentName(field, action.ownerId)
            const titleLower = action.title.toLowerCase()
            const isBuy = titleLower.includes('buy') || titleLower.includes('long')
            const isSell = titleLower.includes('sell') || titleLower.includes('short')
            const hasTrade = isBuy || isSell
            const directionLabel = isBuy ? 'BUY YES' : isSell ? 'SELL / SHORT' : null

            return (
              <div
                key={action.id}
                className={`border-2 bg-neutral-900 ${
                  hasTrade
                    ? isBuy
                      ? 'border-emerald-700'
                      : 'border-rose-700'
                    : 'border-neutral-700'
                }`}
              >
                {/* Card header — direction + market name + status badge */}
                <div className={`px-5 py-3 border-b flex items-center justify-between gap-4 ${
                  hasTrade
                    ? isBuy
                      ? 'border-emerald-800 bg-emerald-950/40'
                      : 'border-rose-800 bg-rose-950/40'
                    : 'border-neutral-800 bg-neutral-800/50'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {directionLabel && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-sm shrink-0 ${
                        isBuy ? 'bg-emerald-600 text-white' : 'bg-rose-700 text-white'
                      }`}>
                        {directionLabel}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-white truncate">{action.title}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-sm ${actionStatusStyle[action.status]}`}>
                    {actionStatusLabel[action.status]}
                  </span>
                </div>

                {/* Card body — rationale + actions */}
                <div className="px-5 py-4">
                  <p className="text-sm text-neutral-300 leading-relaxed">{action.rationale}</p>
                  <p className="mt-3 text-xs text-neutral-600">Proposed by {ownerName}</p>

                  {/* Approve / Reject buttons — prominently sized */}
                  {action.status === 'needs-human' && (
                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 px-5 py-2 rounded-sm transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-white bg-rose-800 hover:bg-rose-700 px-5 py-2 rounded-sm transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-neutral-500 hover:text-neutral-300 px-4 py-2 transition-colors"
                      >
                        Defer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Deliberation transcript */}
      {hasEntries && (
        <div className="divide-y divide-neutral-800/60">
          {field.meeting.entries.map(entry => (
            <MeetingEntryCard key={entry.id} entry={entry} field={field} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Positions Tab ─────────────────────────────────────────────────────────────

function PositionsTab({ field }: { field: Field }) {
  const positions = field.positions
  const candidates = field.candidateMarkets

  return (
    <div className="max-w-3xl">
      {/* Active positions */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">Current positions</h2>
        {positions.length === 0 ? (
          <p className="text-sm text-neutral-600 py-4">No active positions yet.</p>
        ) : (
          <div className="border border-neutral-800 rounded divide-y divide-neutral-800">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2">
              <span className="text-xs text-neutral-600">Market / Thesis</span>
              <span className="text-xs text-neutral-600 text-right">Exposure</span>
              <span className="text-xs text-neutral-600 text-right">Status</span>
            </div>
            {positions.map(pos => (
              <div key={pos.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pos.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{pos.thesis}</p>
                </div>
                <span className="text-sm font-medium text-white tabular-nums whitespace-nowrap">
                  {fmt.format(pos.exposureUsd)}
                </span>
                <span className={`text-xs tabular-nums whitespace-nowrap ${
                  pos.status === 'active'   ? 'text-emerald-400' :
                  pos.status === 'hedged'   ? 'text-amber-400' :
                                              'text-neutral-500'
                }`}>
                  {pos.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate markets */}
      {candidates.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">Candidate markets</h2>
          <div className="border border-neutral-800 rounded divide-y divide-neutral-800">
            {candidates.map(m => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{m.label}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{m.framing}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded border ${
                    m.status === 'ready'
                      ? 'text-emerald-400 bg-emerald-950 border-emerald-800'
                      : m.status === 'under-review'
                        ? 'text-amber-400 bg-amber-950 border-amber-800'
                        : 'text-neutral-500 bg-neutral-900 border-neutral-800'
                  }`}>
                    {m.status.replace('-', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Library Tab ───────────────────────────────────────────────────────────────

const sourceKindLabel: Record<string, string> = {
  article:    'Article',
  book:       'Book',
  briefing:   'Briefing',
  dataset:    'Dataset',
  memo:       'Memo',
  note:       'Note',
  transcript: 'Transcript',
  video:      'Video',
}

function LibraryTab({ field }: { field: Field }) {
  const sources = field.sourceLibrary

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Source library</h2>
        <span className="text-xs text-neutral-600">{sources.length} sources</span>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4">No sources added yet.</p>
      ) : (
        <div className="divide-y divide-neutral-800 border border-neutral-800 rounded">
          {sources.map(source => (
            <div key={source.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-neutral-500 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded">
                      {sourceKindLabel[source.kind] ?? source.kind}
                    </span>
                    <span className="text-xs text-neutral-500">{source.author}</span>
                  </div>
                  <p className="text-sm font-medium text-white">{source.title}</p>
                  {source.note && (
                    <p className="mt-1 text-xs text-neutral-400 leading-relaxed">{source.note}</p>
                  )}
                  {source.relevance && (
                    <p className="mt-1 text-xs text-neutral-500 italic">{source.relevance}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-600">{source.addedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Council Tab ───────────────────────────────────────────────────────────────

function CouncilTab({ field }: { field: Field }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Council</h2>
        <span className="text-xs text-neutral-600">{field.council.length} agents</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {field.council.map((agent: FieldAgent, idx: number) => {
          const color = agentColor(idx)
          return (
            <div key={agent.id} className="border border-neutral-800 rounded bg-neutral-900 p-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-full ${color.bg} flex items-center justify-center text-sm font-bold text-white`}>
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      agent.provisioning === 'hosted'
                        ? 'text-emerald-400 bg-emerald-950 border-emerald-800'
                        : 'text-sky-400 bg-sky-950 border-sky-800'
                    }`}>
                      {agent.provisioning}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{agent.role}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    <span className={`font-medium ${
                      agent.status === 'active'      ? 'text-emerald-400' :
                      agent.status === 'challenging' ? 'text-rose-400'    :
                                                       'text-neutral-500'
                    }`}>
                      {agent.status}
                    </span>
                  </p>
                </div>
              </div>

              {agent.focus && (
                <p className="mt-3 text-xs text-neutral-400 leading-relaxed">{agent.focus}</p>
              )}
              {agent.recentContribution && (
                <p className="mt-2 text-xs text-neutral-600 leading-relaxed italic">
                  {agent.recentContribution}
                </p>
              )}

              {agent.provisioning === 'hosted' && (
                <div className="mt-3 pt-3 border-t border-neutral-800 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Balance</p>
                    <p className="text-xs font-medium text-white mt-0.5">{fmt.format(agent.wallet.balanceUsd)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Allocated</p>
                    <p className="text-xs font-medium text-white mt-0.5">{fmt.format(agent.wallet.allocatedUsd)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-600 uppercase tracking-wider">MTD</p>
                    <p className="text-xs font-medium text-white mt-0.5">{fmt.format(agent.wallet.monthlySpendUsd)}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Capital context */}
      <div className="mt-6 border border-neutral-800 rounded p-4">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">Capital</h3>
        <p className="text-xs text-neutral-500 mb-3">{field.capital.note}</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-neutral-600 mb-1">Field wallet</p>
            <p className="text-sm font-medium text-white">{fmt.format(field.capital.fieldWalletUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">Deployed</p>
            <p className="text-sm font-medium text-white">{fmt.format(field.capital.deployedUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">Available</p>
            <p className="text-sm font-medium text-emerald-400">{fmt.format(field.capital.availableUsd)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FieldDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const field = id ? loadField(id) : undefined
  const activeTab = parseTab(searchParams.get('tab'))

  function setTab(tab: Tab) {
    const next = new URLSearchParams(searchParams)
    if (tab === 'meeting') {
      next.delete('tab')
    } else {
      next.set('tab', tab)
    }
    setSearchParams(next)
  }

  if (!field) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-neutral-500 mb-4">Field not found.</p>
        <Link
          to="/dashboard/fields"
          className="text-sm font-medium text-white border border-neutral-700 px-3 py-1.5 rounded hover:border-neutral-500 transition-colors"
        >
          Back to Fields
        </Link>
      </div>
    )
  }

  const hostedCount = field.council.filter(a => a.provisioning === 'hosted').length

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 pt-6 pb-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
          <Link to="/dashboard" className="hover:text-neutral-300 transition-colors">Overview</Link>
          <span>/</span>
          <Link to="/dashboard/fields" className="hover:text-neutral-300 transition-colors">Fields</Link>
          <span>/</span>
          <span className="text-neutral-400">{field.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs px-2 py-0.5 rounded ${attentionStyles[field.attention]}`}>
                {attentionLabel[field.attention]}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white">{field.name}</h1>
            <p className="mt-1 text-sm text-neutral-400 max-w-2xl leading-relaxed">{field.conviction}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 mb-4 text-xs text-neutral-500">
          <span>{field.council.length} agents ({hostedCount} hosted)</span>
          <span>{field.candidateMarkets.length} markets</span>
          <span>{fmt.format(field.capital.deployedUsd)} deployed</span>
          <span>Updated {field.meeting.updatedAt}</span>
        </div>

        {/* Tabs — underline style per AGENTS.md */}
        <nav className="flex gap-1 border-b border-neutral-800 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-white -mb-px'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {activeTab === 'meeting'   && <MeetingTab   field={field} />}
        {activeTab === 'positions' && <PositionsTab field={field} />}
        {activeTab === 'library'   && <LibraryTab   field={field} />}
        {activeTab === 'council'   && <CouncilTab   field={field} />}
      </div>
    </div>
  )
}
