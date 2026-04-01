import { Link } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { Field, FieldAttention } from './fieldTypes'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const attentionBadge: Record<FieldAttention, string> = {
  steady: 'text-emerald-400 bg-emerald-950 border border-emerald-800',
  review: 'text-amber-400 bg-amber-950 border border-amber-800',
  'needs-input': 'text-sky-400 bg-sky-950 border border-sky-800',
}
const attentionLabel: Record<FieldAttention, string> = {
  steady: 'Steady',
  review: 'Review',
  'needs-input': 'Needs input',
}

// ─── Action queue item type labels ──────────────────────────────────────────

type ActionType = 'counter-evidence' | 'proposal' | 'question'

const actionTypeStyle: Record<ActionType, string> = {
  'counter-evidence': 'bg-rose-950 border-rose-800 text-rose-400',
  'proposal': 'bg-sky-950 border-sky-800 text-sky-400',
  'question': 'bg-amber-950 border-amber-800 text-amber-400',
}

const actionTypeLabel: Record<ActionType, string> = {
  'counter-evidence': 'Counter-evidence',
  'proposal': 'Proposal',
  'question': 'Question',
}

// ─── Status line tone ────────────────────────────────────────────────────────

type StatusTone = 'counter' | 'confirm' | 'neutral'

function StatusLine({ text, tone }: { text: string; tone: StatusTone }) {
  const cls =
    tone === 'counter'
      ? 'text-rose-400'
      : tone === 'confirm'
        ? 'text-emerald-400'
        : 'text-neutral-500'
  return <p className={`mt-2 text-xs italic leading-relaxed ${cls}`}>"{text}"</p>
}

// ─── Field Card (live data) ───────────────────────────────────────────────────

function FieldCard({ field }: { field: Field }) {
  const hostedCount = field.council.filter(a => a.provisioning === 'hosted').length
  const statusLine = field.meeting.summary || 'Agents are monitoring.'
  const statusTone: StatusTone =
    field.attention === 'needs-input' ? 'counter' :
    field.attention === 'review' ? 'counter' : 'neutral'

  return (
    <Link
      to={`/dashboard/field/${field.id}`}
      className="block border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 hover:bg-neutral-800/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-white leading-snug">{field.name}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-sm ${attentionBadge[field.attention]}`}>
          {attentionLabel[field.attention]}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
        {field.conviction}
      </p>
      <StatusLine text={statusLine} tone={statusTone} />
      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
        <span>{field.council.length} agents ({hostedCount} hosted)</span>
        <span>{field.candidateMarkets.length} markets</span>
        <span>{fmt.format(field.capital.deployedUsd)} deployed</span>
        <span className="ml-auto">{field.meeting.updatedAt}</span>
      </div>
    </Link>
  )
}

// ─── Empty action queue callout ───────────────────────────────────────────────

function AllClearBanner() {
  return (
    <div className="flex items-center gap-3 border border-neutral-800 bg-neutral-900 px-4 py-3 mb-6">
      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <p className="text-xs text-neutral-400">Nothing waiting on you right now. Agents are working.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const workspace = loadFieldWorkspace()
  const fields = workspace.fields
  const hasFields = fields.length > 0

  // Derive action items from live field meeting status
  const actionItems = fields
    .filter(f => f.meeting.status === 'awaiting-human' || f.attention === 'needs-input')
    .map(f => ({
      id: f.id,
      type: 'proposal' as ActionType,
      fieldId: f.id,
      fieldName: f.name,
      message: f.meeting.summary || 'Agents need direction',
      urgency: 'high' as const,
      agent: f.council[0]?.name ?? 'Agent',
      at: f.meeting.updatedAt,
    }))

  // Morning-style heading based on time
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 5 ? 'Still running overnight' :
    hour < 12 ? 'Your agents worked overnight' :
    hour < 17 ? 'Here\'s where things stand' :
    'End-of-day briefing'

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Briefing header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">{timeGreeting}.</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          {actionItems.length > 0
            ? `${actionItems.length} item${actionItems.length !== 1 ? 's' : ''} need${actionItems.length === 1 ? 's' : ''} your input.`
            : 'No pending decisions.'}
        </p>
      </div>

      {/* Needs Your Input — action queue */}
      {actionItems.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
            Needs your input
          </h2>
          <div className="border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            {actionItems.map(item => (
              <Link
                key={item.id}
                to={`/dashboard/field/${item.fieldId}`}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-neutral-800/50 transition-colors"
              >
                <div className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 border rounded-sm ${actionTypeStyle[item.type]}`}>
                  {actionTypeLabel[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{item.fieldName}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{item.message}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-neutral-500">{item.agent}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{item.at}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <AllClearBanner />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Left: Fields */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
              {hasFields ? 'Your fields' : 'Fields'}
            </h2>
            {hasFields ? (
              <Link to="/dashboard/fields" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                View all →
              </Link>
            ) : (
              <Link to="/dashboard/fields" className="text-xs font-medium text-white border border-neutral-700 px-3 py-1 hover:border-neutral-500 transition-colors">
                + New field
              </Link>
            )}
          </div>

          {hasFields ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-px border border-neutral-800">
              {fields.map(field => (
                <FieldCard key={field.id} field={field} />
              ))}
            </div>
          ) : (
            <div className="border border-neutral-800 px-6 py-10 text-center">
              <p className="text-sm font-medium text-white mb-1">No active fields yet</p>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                Fields are research and trading workspaces where your agents deliberate, gather evidence, and propose positions.
              </p>
              <Link
                to="/dashboard/fields"
                className="inline-block mt-5 text-xs font-medium text-white border border-neutral-700 px-4 py-2 hover:border-neutral-500 transition-colors"
              >
                Create your first field →
              </Link>
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <div>
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
            Recent activity
          </h2>
          {hasFields ? (
            <div className="border border-neutral-800 px-4 py-8 text-center">
              <p className="text-xs text-neutral-500">No activity yet.</p>
              <p className="mt-1 text-xs text-neutral-700 leading-relaxed">
                Agent actions, proposals, and position changes appear here.
              </p>
            </div>
          ) : (
            <div className="border border-neutral-800 px-4 py-8 text-center">
              <p className="text-xs text-neutral-500">No activity yet.</p>
              <p className="mt-1 text-xs text-neutral-700 leading-relaxed">
                Agent actions, proposals, and position changes appear here.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}


