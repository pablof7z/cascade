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

// Agent color identities used in demo card
const DEMO_AGENT_COLORS = ['bg-emerald-500', 'bg-violet-500', 'bg-amber-500']

const DEMO_FIELD = {
  id: 'ai-application-layer',
  name: 'AI application layer',
  conviction: 'Agent-native workflows pull margin away from thin SaaS wrappers once teams bring proprietary context and approvals into the product.',
  attention: 'needs-input' as FieldAttention,
  agentCount: 3,
  marketCount: 2,
  capital: 4800,
  lastActivity: '7 min ago',
  agents: ['Mara Synthesis', 'Rowan Skeptic', 'Vale Operator'],
  preview: 'Rowan is pushing back on the distribution-lag thesis. Mara just added evidence from the support archive.',
}

const ACTIVITY_FEED = [
  { id: 1, time: '7 min ago', event: 'Rowan Skeptic posted a counterargument in AI application layer' },
  { id: 2, time: '22 min ago', event: 'Iris Grid updated the industrial pricing evidence in European energy spread' },
  { id: 3, time: '1 hour ago', event: 'Darya Routes refreshed the container routing tracker' },
  { id: 4, time: '3 hours ago', event: 'Mara Synthesis added 2 new library sources' },
  { id: 5, time: '5 hours ago', event: 'You approved action: Keep exposure flat in Red Sea shipping' },
  { id: 6, time: 'Yesterday', event: 'European energy spread moved to Review status' },
]

const ATTENTION_ITEMS = [
  { id: 1, fieldId: 'ai-application-layer', fieldName: 'AI application layer', message: 'Pending action needs your approval', urgency: 'high' as const },
  { id: 2, fieldId: 'europe-energy-spread', fieldName: 'European energy spread', message: 'Next grid report is the capital gate', urgency: 'medium' as const },
]

function FieldCard({ field }: { field: Field }) {
  const hostedCount = field.council.filter(a => a.provisioning === 'hosted').length
  return (
    <Link
      to={`/dashboard/field/${field.id}`}
      className="block border border-neutral-800 rounded bg-neutral-900 p-5 hover:border-neutral-600 hover:bg-neutral-800/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-white leading-snug">{field.name}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${attentionBadge[field.attention]}`}>
          {attentionLabel[field.attention]}
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
        {field.conviction}
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
        <span>{field.council.length} agents ({hostedCount} hosted)</span>
        <span>{field.candidateMarkets.length} markets</span>
        <span>{fmt.format(field.capital.deployedUsd)} deployed</span>
      </div>
      <div className="mt-3 text-xs text-neutral-600">
        Updated {field.meeting.updatedAt}
      </div>
    </Link>
  )
}

function DemoFieldCard() {
  return (
    <div className="border border-dashed border-neutral-700 rounded bg-neutral-900/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
          Demo
        </span>
        <span className="text-xs text-neutral-600">— this is what a live field looks like</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-white leading-snug">{DEMO_FIELD.name}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${attentionBadge[DEMO_FIELD.attention]}`}>
          {attentionLabel[DEMO_FIELD.attention]}
        </span>
      </div>

      <p className="mt-2 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
        {DEMO_FIELD.conviction}
      </p>

      {/* Mini deliberation preview */}
      <div className="mt-4 border border-neutral-800 rounded bg-neutral-950 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white">R</div>
          <span className="text-xs font-medium text-neutral-300">Rowan Skeptic</span>
          <span className="text-xs text-neutral-600">counterargument · 13 min ago</span>
        </div>
        <p className="text-xs text-neutral-400 pl-7">Distribution may outrun workflow quality for another buying cycle...</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">M</div>
          <span className="text-xs font-medium text-neutral-300">Mara Synthesis</span>
          <span className="text-xs text-neutral-600">evidence · 18 min ago</span>
        </div>
        <p className="text-xs text-neutral-400 pl-7">Source library keeps pointing to approval-heavy internal workflows... <span className="text-neutral-600">[Support archive, 2024]</span></p>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
        <div className="flex -space-x-1">
          {DEMO_AGENT_COLORS.map((color, i) => (
            <div key={i} className={`w-5 h-5 rounded-full ${color} border border-neutral-900`} />
          ))}
        </div>
        <span>{DEMO_FIELD.agentCount} agents</span>
        <span>{DEMO_FIELD.marketCount} markets</span>
        <span>{fmt.format(DEMO_FIELD.capital)} deployed</span>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between">
        <p className="text-xs text-neutral-600">Your first field will look like this, with your agents and your data.</p>
        <Link
          to="/dashboard/fields"
          className="text-xs font-medium text-white border border-neutral-700 px-3 py-1.5 rounded hover:border-neutral-500 transition-colors"
        >
          + Create your first field
        </Link>
      </div>
    </div>
  )
}

export default function DashboardOverview() {
  const workspace = loadFieldWorkspace()
  const fields = workspace.fields
  const hasFields = fields.length > 0

  const attentionItems = hasFields
    ? ATTENTION_ITEMS.filter(item => fields.some(f => f.id === item.fieldId))
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Overview</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Your field workspace at a glance.</p>
      </div>

      {/* Needs Attention */}
      {attentionItems.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">Needs attention</h2>
          <div className="flex flex-wrap gap-3">
            {attentionItems.map(item => (
              <Link
                key={item.id}
                to={`/dashboard/field/${item.fieldId}`}
                className="flex items-start gap-3 border border-neutral-800 rounded bg-neutral-900 px-4 py-3 hover:border-neutral-600 transition-colors min-w-0"
              >
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.urgency === 'high' ? 'bg-sky-400' : 'bg-amber-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{item.fieldName}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.message}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left: Fields */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
              {hasFields ? 'Fields' : 'Your workspace'}
            </h2>
            {hasFields && (
              <Link to="/dashboard/fields" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                View all →
              </Link>
            )}
          </div>

          {hasFields ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {fields.map(field => (
                <FieldCard key={field.id} field={field} />
              ))}
            </div>
          ) : (
            <DemoFieldCard />
          )}
        </div>

        {/* Right: Activity feed */}
        <div>
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">Recent activity</h2>
          <div className="divide-y divide-neutral-800 border border-neutral-800 rounded">
            {ACTIVITY_FEED.map(item => (
              <div key={item.id} className="px-4 py-3">
                <p className="text-xs text-neutral-300 leading-relaxed">{item.event}</p>
                <p className="mt-1 text-xs text-neutral-600">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
