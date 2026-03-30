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

const tabConfig: {
  key: MarketTabKey
  label: string
  description: string
  href: (marketId: string) => string
}[] = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Signal summary, positioning, and trade frame.',
    href: (marketId) => `/market/${marketId}`,
  },
  {
    key: 'discussion',
    label: 'Discussion',
    description: 'Threads, rebuttals, and fresh arguments.',
    href: (marketId) => `/market/${marketId}/discussion`,
  },
  {
    key: 'charts',
    label: 'Charts',
    description: 'Price curve, execution trail, and context.',
    href: (marketId) => `/market/${marketId}/charts`,
  },
  {
    key: 'activity',
    label: 'Activity',
    description: 'Receipts, participant moves, and event log.',
    href: (marketId) => `/market/${marketId}/activity`,
  },
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
    <header className="mb-10 space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
      >
        ← Back to Markets
      </Link>

      <div className="overflow-hidden rounded-[28px] border border-neutral-800 bg-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_32%),linear-gradient(180deg,_rgba(23,23,23,0.96),_rgba(10,10,10,1))] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-neutral-300">
                  Market Detail
                </span>
                <span>Live market surface</span>
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {marketTitle}
              </h1>
              {marketDescription ? (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
                  {marketDescription}
                </p>
              ) : null}
            </div>

            {headerAction ? (
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">{headerAction}</div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Live odds</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-400">
                {(probability * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Reserve depth</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(reserve)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Executed trades</div>
              <div className="mt-2 text-2xl font-semibold text-white">{tradeCount}</div>
            </div>
          </div>
        </div>

        <nav
          aria-label="Market detail sections"
          className="grid gap-px bg-neutral-800 sm:grid-cols-2 xl:grid-cols-4"
        >
          {tabConfig.map((tab, index) => {
            const isActive = tab.key === activeTab
            return (
              <Link
                key={tab.key}
                to={tab.href(marketId)}
                aria-current={isActive ? 'page' : undefined}
                className={`group px-5 py-5 transition-colors ${
                  isActive
                    ? 'bg-white text-neutral-950'
                    : 'bg-neutral-950 text-neutral-300 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.24em] ${
                    isActive ? 'text-neutral-500' : 'text-neutral-600 group-hover:text-neutral-500'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="mt-2 text-base font-semibold">{tab.label}</div>
                <div
                  className={`mt-1 text-sm leading-relaxed ${
                    isActive ? 'text-neutral-600' : 'text-neutral-500 group-hover:text-neutral-400'
                  }`}
                >
                  {tab.description}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
