import { useState, useMemo } from 'react'
import { generateMockAgentPnLData, filterDataByDays } from './lib/mockPnLData'
import AggregatePnLChart from './AggregatePnLChart'
import PerAgentPnLChart from './PerAgentPnLChart'

type TimeFilter = '7d' | '30d' | 'all-time'

const TIME_FILTERS: { value: TimeFilter; label: string; days: number | null }[] = [
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: 'all-time', label: 'All Time', days: null },
]

const ALL_DATA = generateMockAgentPnLData()

export default function PnLCharts() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all-time')

  const selectedFilter = TIME_FILTERS.find((f) => f.value === timeFilter)!
  const filteredData = useMemo(
    () => filterDataByDays(ALL_DATA, selectedFilter.days),
    [selectedFilter.days],
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
          P&L Evolution
        </h2>
        <nav className="flex gap-1 border-b border-neutral-800">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTimeFilter(f.value)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                timeFilter === f.value
                  ? '-mb-px border-b-2 border-white text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      </div>

      <PerAgentPnLChart data={filteredData} />
      <AggregatePnLChart data={filteredData} />
    </div>
  )
}
