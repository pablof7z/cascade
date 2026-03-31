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

// ─── Mock data for demo / preview state ─────────────────────────────────────

const DEMO_ACTION_QUEUE = [
  {
    id: 'a1',
    type: 'counter-evidence' as const,
    fieldId: 'ai-application-layer',
    fieldName: 'AI application layer',
    message: 'Rowan found counter-evidence to your EU timeline thesis — 3 citations',
    urgency: 'high' as const,
    agent: 'Rowan Skeptic',
    at: '14 min ago',
  },
  {
    id: 'a2',
    type: 'proposal' as const,
    fieldId: 'eu-ai-regulation',
    fieldName: 'EU AI regulation',
    message: '2 position proposals awaiting your approval',
    urgency: 'high' as const,
    agent: 'Mara Synthesis',
    at: '1 hour ago',
  },
  {
    id: 'a3',
    type: 'question' as const,
    fieldId: 'red-sea-shipping',
    fieldName: 'Red Sea shipping',
    message: 'Agents are stuck — need your read on the rerouting timeline',
    urgency: 'medium' as const,
    agent: 'Darya Routes',
    at: '3 hours ago',
  },
]

const DEMO_FIELDS = [
  {
    id: 'ai-application-layer',
    name: 'AI application layer',
    conviction: 'Agent-native workflows pull margin away from thin SaaS wrappers once teams bring proprietary context and approvals into the product.',
    attention: 'needs-input' as FieldAttention,
    agentCount: 3,
    marketCount: 2,
    capital: 4800,
    lastActivity: '14 min ago',
    statusLine: 'Agents are pushing back on your take on EU timeline',
    statusTone: 'counter' as const,
  },
  {
    id: 'eu-ai-regulation',
    name: 'EU AI regulation',
    conviction: 'Regulation accelerates post-2026 elections, creating compliance moats for incumbents already in the approval queue.',
    attention: 'review' as FieldAttention,
    agentCount: 2,
    marketCount: 4,
    capital: 6200,
    lastActivity: '1 hour ago',
    statusLine: 'New enforcement data confirms your read on incumbents',
    statusTone: 'confirm' as const,
  },
  {
    id: 'red-sea-shipping',
    name: 'Red Sea shipping',
    conviction: 'Rerouting costs are sticky — carriers will hold the premium for 18 months even after the security situation normalises.',
    attention: 'steady' as FieldAttention,
    agentCount: 2,
    marketCount: 2,
    capital: 3100,
    lastActivity: '3 hours ago',
    statusLine: 'Agents are monitoring. No new contradictions found.',
    statusTone: 'neutral' as const,
  },
]

const DEMO_ACTIVITY = [
  { id: 1, at: '14 min ago', agent: 'Rowan Skeptic', field: 'AI application layer', event: 'Posted counter-evidence on distribution-lag thesis — cites 3 sources' },
  { id: 2, at: '1 hour ago', agent: 'Mara Synthesis', field: 'EU AI regulation', event: 'Proposed position: BUY YES on S.42 enforcement timeline ($500)' },
  { id: 3, at: '2 hours ago', agent: 'Iris Grid', field: 'EU AI regulation', event: 'Updated industrial pricing evidence from EU Commission draft' },
  { id: 4, at: '3 hours ago', agent: 'Darya Routes', field: 'Red Sea shipping', event: 'Refreshed container routing tracker — Suez volume -34% vs baseline' },
  { id: 5, at: '5 hours ago', agent: 'Mara Synthesis', field: 'AI application layer', event: 'Added 2 new sources to library: Sequoia AI survey, OpenAI enterprise report' },
  { id: 6, at: 'Yesterday', label: 'You', field: 'Red Sea shipping', event: 'Approved action: Keep exposure flat until Q3 routing data lands' },
  { id: 7, at: 'Yesterday', agent: 'Vale Operator', field: 'EU AI regulation', event: 'Meeting note: Article 10 compliance window is shorter than your model assumes' },
]

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
  // derive status line from meeting summary
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

// ─── Demo Field Card ──────────────────────────────────────────────────────────

function DemoFieldCard({ f }: { f: typeof DEMO_FIELDS[0] }) {
  const statusColor =
    f.statusTone === 'counter' ? 'text-rose-400' :
    f.statusTone === 'confirm' ? 'text-emerald-400' :
    'text-neutral-500'

  return (
    <div className="block border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-white leading-snug">{f.name}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-sm ${attentionBadge[f.attention]}`}>
          {attentionLabel[f.attention]}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
        {f.conviction}
      </p>
      <p className={`mt-2 text-xs italic leading-relaxed ${statusColor}`}>
        "{f.statusLine}"
      </p>
      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
        <span>{f.agentCount} agents</span>
        <span>{f.marketCount} markets</span>
        <span>{fmt.format(f.capital)} deployed</span>
        <span className="ml-auto">{f.lastActivity}</span>
      </div>
    </div>
  )
}

// ─── Demo preview block ───────────────────────────────────────────────────────

function DemoPreviewBanner() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-xs px-2 py-0.5 bg-neutral-800 border border-neutral-700 text-neutral-500 rounded-sm">
        Preview
      </span>
      <span className="text-xs text-neutral-600">— sample workspace with agents mid-deliberation</span>
    </div>
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

  // With real fields, derive action items from meeting status
  const liveActionItems = hasFields
    ? fields
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
    : []

  const actionItems = hasFields ? liveActionItems : DEMO_ACTION_QUEUE
  const displayFields = hasFields ? null : DEMO_FIELDS
  const activityFeed = DEMO_ACTIVITY

  // Morning-style heading based on time
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 5 ? 'Still running overnight' :
    hour < 12 ? 'Your agents worked overnight' :
    hour < 17 ? 'Here\'s where things stand' :
    'End-of-day briefing'

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Briefing header — not a greeting */}
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

          {!hasFields && <DemoPreviewBanner />}

          {hasFields ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-px border border-neutral-800">
              {fields.map(field => (
                <FieldCard key={field.id} field={field} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-px border border-neutral-800">
              {displayFields!.map(f => (
                <DemoFieldCard key={f.id} f={f} />
              ))}
            </div>
          )}

          {!hasFields && (
            <div className="mt-4 border border-dashed border-neutral-700 px-4 py-4 text-center">
              <p className="text-xs text-neutral-600 mb-3">
                This is what your workspace looks like once you've created a field and hired agents.
              </p>
              <Link
                to="/dashboard/fields"
                className="text-xs font-medium text-white border border-neutral-700 px-4 py-2 hover:border-neutral-500 transition-colors"
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
          <div className="border border-neutral-800 divide-y divide-neutral-800">
            {activityFeed.map(item => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-neutral-300">
                    {item.agent ?? item.label}
                  </span>
                  {item.field && (
                    <>
                      <span className="text-neutral-700">·</span>
                      <span className="text-xs text-neutral-600">{item.field}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{item.event}</p>
                <p className="mt-1 text-xs text-neutral-600">{item.at}</p>
              </div>
            ))}
          </div>
          {!hasFields && (
            <p className="mt-2 text-xs text-neutral-700 text-right">Sample activity</p>
          )}
        </div>

      </div>
    </div>
  )
}
