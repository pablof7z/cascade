import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export type MarketTabKey = 'overview' | 'discussion' | 'charts' | 'activity'

interface Props {
  marketId: string
  marketTitle: string
  marketDescription?: string
  probability: number
  reserve: number
  tradeCount: number
  activeTab: MarketTabKey
  headerAction?: ReactNode
}

const tabConfig: { key: MarketTabKey; label: string; href: (marketId: string) => string }[] = [
  { key: 'overview', label: 'Overview', href: (marketId) => `/market/${marketId}` },
  { key: 'discussion', label: 'Discussion', href: (marketId) => `/market/${marketId}/discussion` },
  { key: 'charts', label: 'Charts', href: (marketId) => `/market/${marketId}/charts` },
  { key: 'activity', label: 'Activity', href: (marketId) => `/market/${marketId}/activity` },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

export default function MarketTabsShell({
  marketId,
  marketTitle,
  marketDescription,
  probability,
  reserve,
  tradeCount,
  activeTab,
  headerAction,
}: Props) {
  return (
    <header className="mb-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white"
      >
        ← Back to Markets
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-neutral-600">Market</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">{marketTitle}</h1>
          {marketDescription ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400">
              {marketDescription}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">Yes</span>
              <div className="mt-1 text-sm font-medium text-emerald-400">
                {(probability * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">Reserve</span>
              <div className="mt-1 text-sm font-medium text-white">{formatCurrency(reserve)}</div>
            </div>
            <div className="rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">Trades</span>
              <div className="mt-1 text-sm font-medium text-white">{tradeCount}</div>
            </div>
          </div>
        </div>

        {headerAction ? <div className="flex flex-wrap items-center gap-3">{headerAction}</div> : null}
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
        {tabConfig.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              to={tab.href(marketId)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-neutral-950'
                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
