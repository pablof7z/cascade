import { useEffect, useState } from 'react'
import type { AnalyticsSummary } from './analyticsTypes'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-neutral-400 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-neutral-900 relative">
        <div
          className="h-full bg-emerald-600"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="w-16 text-right tabular-nums text-neutral-200">
        {value.toLocaleString()}
      </span>
      {max > 0 && value < max && (
        <span className="w-14 text-right text-neutral-500 text-xs">
          {((value / max) * 100).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: AnalyticsSummary) => {
        setSummary(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-neutral-500">Loading analytics…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-rose-400">Error: {error}</p>
      </div>
    )
  }

  if (!summary) return null

  const funnelMax = Math.max(summary.funnel.pageViews, 1)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold text-neutral-100 mb-6 tracking-tight">
        Analytics
      </h1>

      {/* Session metrics */}
      <div className="grid grid-cols-3 gap-px bg-neutral-800 mb-8">
        <div className="bg-neutral-950 p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">DAU</div>
          <div className="text-2xl tabular-nums text-neutral-100">
            {summary.dailyActiveSessions.toLocaleString()}
          </div>
        </div>
        <div className="bg-neutral-950 p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">WAU</div>
          <div className="text-2xl tabular-nums text-neutral-100">
            {summary.weeklyActiveSessions.toLocaleString()}
          </div>
        </div>
        <div className="bg-neutral-950 p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Avg Session</div>
          <div className="text-2xl tabular-nums text-neutral-100">
            {formatDuration(summary.averageSessionDuration)}
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-3">
        Conversion Funnel
      </h2>
      <div className="space-y-2 mb-8">
        <FunnelBar label="Page Views" value={summary.funnel.pageViews} max={funnelMax} />
        <FunnelBar label="Market Views" value={summary.funnel.marketViews} max={funnelMax} />
        <FunnelBar label="Trades Placed" value={summary.funnel.tradesPlaced} max={funnelMax} />
      </div>

      {/* Top markets */}
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-3">
        Most Viewed Markets
      </h2>
      {summary.topMarkets.length === 0 ? (
        <p className="text-neutral-600 text-sm mb-8">No market view data yet.</p>
      ) : (
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800">
              <th className="text-left py-2 font-medium">#</th>
              <th className="text-left py-2 font-medium">Market ID</th>
              <th className="text-right py-2 font-medium">Views</th>
            </tr>
          </thead>
          <tbody>
            {summary.topMarkets.map((m, i) => (
              <tr key={m.marketId} className="border-b border-neutral-900">
                <td className="py-1.5 text-neutral-500">{i + 1}</td>
                <td className="py-1.5 text-neutral-200 font-mono text-xs">{m.marketId}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-300">
                  {m.views.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-neutral-600">
        Generated {new Date(summary.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
