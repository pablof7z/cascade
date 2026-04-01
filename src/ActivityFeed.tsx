// ─── Activity Feed Page ───────────────────────────────────────────────────────
// Chronological stream of everything happening across the user's workspace —
// agent actions, meeting entries, proposals, position changes, and source adds.

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'Meeting' | 'Proposal' | 'Position' | 'Source' | 'System'

// ─── Sub-components ───────────────────────────────────────────────────────────

// Type badge styles
const TYPE_STYLES: Record<EntryType, string> = {
  Meeting:  'border-sky-800 text-sky-400',
  Proposal: 'border-violet-800 text-violet-400',
  Position: 'border-emerald-800 text-emerald-400',
  Source:   'border-amber-800 text-amber-400',
  System:   'border-neutral-700 text-neutral-500',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityFeed() {
  return (
    <div className="p-8 space-y-8">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-base font-semibold text-white">Activity</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Everything happening across your workspace, most recent first.
        </p>
      </div>

      {/* ── Entry type legend ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 pb-5">
        <span className="text-xs text-neutral-600 shrink-0">Entry types:</span>
        {(Object.keys(TYPE_STYLES) as EntryType[]).map(t => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>

      {/* ── Empty state ── */}
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-white mb-1">No activity yet</p>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
          Agent actions, meeting entries, proposals, position changes, and source additions appear here once your workspace is active.
        </p>
      </div>

    </div>
  )
}


