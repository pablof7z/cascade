// ─── Treasury Page ───────────────────────────────────────────────────────────
// Shows where the user's capital is and what it's doing across all fields
// and agents.

import React from 'react'
import PnLCharts from './PnLCharts'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function EmptySection({ headline, detail }: { headline: string; detail: string }) {
  return (
    <div className="border border-neutral-800 px-5 py-8 text-center">
      <p className="text-sm font-medium text-white mb-1">{headline}</p>
      <p className="text-xs text-neutral-500 leading-relaxed">{detail}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  return (
    <div className="p-8 space-y-10">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-base font-semibold text-white">Treasury</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Capital allocation across all fields and agents.
        </p>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-4 gap-px bg-neutral-800 border border-neutral-800">
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Total capital</p>
          <p className="text-2xl font-semibold text-neutral-600 tabular-nums">$0</p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Deployed</p>
          <p className="text-2xl font-semibold text-neutral-600 tabular-nums">$0</p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Available</p>
          <p className="text-2xl font-semibold text-neutral-600 tabular-nums">$0</p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Overall P&amp;L</p>
          <p className="text-2xl font-semibold text-neutral-600 tabular-nums">—</p>
        </div>
      </div>

      {/* ── By Field ── */}
      <div>
        <SectionHeading>By Field</SectionHeading>
        <EmptySection
          headline="No fields with deployed capital"
          detail="Capital breakdown by field appears here once you've created fields and funded agents."
        />
      </div>

      {/* ── By Agent ── */}
      <div>
        <PnLCharts />
      </div>

      {/* ── Open Positions ── */}
      <div>
        <SectionHeading>Open Positions</SectionHeading>
        <EmptySection
          headline="No open positions"
          detail="Active market positions taken by your agents appear here."
        />
      </div>

      {/* ── Recent Transactions ── */}
      <div>
        <SectionHeading>Recent Transactions</SectionHeading>
        <div className="border border-neutral-800 px-5 py-8 text-center">
          <p className="text-xs text-neutral-500">No transactions yet.</p>
        </div>
      </div>

    </div>
  )
}


