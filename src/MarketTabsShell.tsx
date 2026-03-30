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
  href: (marketId: string) => string
}[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: (marketId) => `/market/${marketId}`,
  },
  {
    key: 'discussion',
    label: 'Discussion',
    href: (marketId) => `/market/${marketId}/discussion`,
  },
  {
    key: 'charts',
    label: 'Charts',
    href: (marketId) => `/market/${marketId}/charts`,
  },
  {
    key: 'activity',
    label: 'Activity',
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
    <header className="mb-6 space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
      >
        ← Back to Markets
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="max-w-4xl text-xl font-semibold leading-tight text-white sm:text-2xl">
            {marketTitle}
          </h1>
          {marketDescription ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
              {marketDescription}
            </p>
          ) : null}
        </div>

        {headerAction ? (
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">{headerAction}</div>
        ) : null}
      </div>

      <div className="flex items-center gap-6 text-sm text-neutral-400">
        <span>
          <span className="font-medium text-emerald-400">{(probability * 100).toFixed(1)}%</span>{' '}
          odds
        </span>
        <span>
          <span className="font-medium text-white">{formatCurrency(reserve)}</span> reserve
        </span>
        <span>
          <span className="font-medium text-white">{tradeCount}</span> trades
        </span>
      </div>

      <nav
        aria-label="Market detail sections"
        className="flex gap-1 border-b border-neutral-800 pt-2"
      >
        {tabConfig.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              to={tab.href(marketId)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? '-mb-px border-b-2 border-white text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
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
