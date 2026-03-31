import { useNavigate } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { Field, FieldAttention } from './fieldTypes'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const attentionStyles: Record<FieldAttention, string> = {
  steady: 'text-emerald-400 bg-emerald-950 border border-emerald-800',
  review: 'text-amber-400 bg-amber-950 border border-amber-800',
  'needs-input': 'text-sky-400 bg-sky-950 border border-sky-800',
}

const attentionLabel: Record<FieldAttention, string> = {
  steady: 'Steady',
  review: 'Review',
  'needs-input': 'Needs input',
}

function FieldRow({ field }: { field: Field }) {
  const navigate = useNavigate()
  const conviction = field.conviction.length > 72
    ? field.conviction.slice(0, 72) + '…'
    : field.conviction

  return (
    <button
      type="button"
      onClick={() => navigate(`/dashboard/field/${field.id}`)}
      className="w-full text-left grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-neutral-800/50 transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-white">{field.name}</p>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">{conviction}</p>
      </div>
      <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${attentionStyles[field.attention]}`}>
        {attentionLabel[field.attention]}
      </span>
      <span className="shrink-0 text-xs text-neutral-400 tabular-nums">
        {field.council.length} <span className="text-neutral-600">agents</span>
      </span>
      <span className="shrink-0 text-xs text-neutral-400 tabular-nums">
        {field.candidateMarkets.length} <span className="text-neutral-600">markets</span>
      </span>
      <span className="shrink-0 text-xs text-neutral-400 tabular-nums">
        {fmt.format(field.capital.deployedUsd)}
      </span>
      <span className="shrink-0 text-xs text-neutral-600 tabular-nums">
        {field.meeting.updatedAt}
      </span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-10 h-10 border border-neutral-700 rounded flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p className="text-sm font-medium text-white mb-1">No fields yet</p>
      <p className="text-xs text-neutral-500 max-w-xs">
        A field is a research and trading workspace where your agents deliberate, gather evidence, and propose positions.
      </p>
      <button
        type="button"
        className="mt-5 text-sm font-medium text-white border border-neutral-700 px-4 py-2 rounded hover:border-neutral-500 transition-colors"
      >
        + New Field
      </button>
    </div>
  )
}

export default function FieldsList() {
  const workspace = loadFieldWorkspace()
  const fields = workspace.fields

  const active = fields.filter(f => f.attention !== 'steady' || f.meeting.status !== 'watching')
  const draft = fields.filter(f => f.meeting.status === 'watching' && f.attention === 'steady')
  const concluded: Field[] = []

  const sections: { label: string; items: Field[] }[] = [
    { label: 'Active', items: active },
    { label: 'Watching', items: draft },
    { label: 'Concluded', items: concluded },
  ].filter(s => s.items.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Fields</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {fields.length === 0 ? 'No active fields' : `${fields.length} field${fields.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-white border border-neutral-700 px-3 py-1.5 rounded hover:border-neutral-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          New Field
        </button>
      </div>

      {fields.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                  {section.label}
                </span>
                <span className="text-xs text-neutral-700">{section.items.length}</span>
              </div>
              <div className="border border-neutral-800 rounded divide-y divide-neutral-800">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-2">
                  <span className="text-xs text-neutral-600">Name / Conviction</span>
                  <span className="text-xs text-neutral-600">Status</span>
                  <span className="text-xs text-neutral-600">Agents</span>
                  <span className="text-xs text-neutral-600">Markets</span>
                  <span className="text-xs text-neutral-600">Capital</span>
                  <span className="text-xs text-neutral-600">Updated</span>
                </div>
                {section.items.map(field => (
                  <FieldRow key={field.id} field={field} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
