import { useState } from 'react'
import { Link } from 'react-router-dom'

type PositionType = 'module' | 'thesis'
type PositionSide = 'YES' | 'NO'

interface Position {
  id: string
  marketName: string
  type: PositionType
  side: PositionSide
  amount: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

// Mock positions data
const mockModulePositions: Position[] = [
  {
    id: '1',
    marketName: 'AGI achieved by 2030',
    type: 'module',
    side: 'YES',
    amount: 500,
    avgPrice: 0.42,
    currentPrice: 0.58,
    pnl: 80,
    pnlPercent: 38.1,
  },
  {
    id: '2',
    marketName: 'First Mars landing with crew by 2035',
    type: 'module',
    side: 'NO',
    amount: 250,
    avgPrice: 0.65,
    currentPrice: 0.71,
    pnl: -15,
    pnlPercent: -6.0,
  },
  {
    id: '3',
    marketName: 'Fusion power plant goes online',
    type: 'module',
    side: 'YES',
    amount: 300,
    avgPrice: 0.35,
    currentPrice: 0.41,
    pnl: 18,
    pnlPercent: 17.1,
  },
]

const mockThesisPositions: Position[] = [
  {
    id: '4',
    marketName: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth',
    type: 'thesis',
    side: 'YES',
    amount: 750,
    avgPrice: 0.55,
    currentPrice: 0.62,
    pnl: 52.5,
    pnlPercent: 12.7,
  },
  {
    id: '5',
    marketName: 'Space economy exceeds $1T by 2040',
    type: 'thesis',
    side: 'YES',
    amount: 400,
    avgPrice: 0.48,
    currentPrice: 0.52,
    pnl: 16,
    pnlPercent: 8.3,
  },
]

const tabs = ['Module Positions', 'Thesis Positions'] as const
type Tab = typeof tabs[number]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<Tab>('Module Positions')

  const allPositions = [...mockModulePositions, ...mockThesisPositions]
  const totalInvested = allPositions.reduce((sum, p) => sum + p.amount, 0)
  const totalPnl = allPositions.reduce((sum, p) => sum + p.pnl, 0)
  const currentValue = totalInvested + totalPnl
  const totalPnlPercent = (totalPnl / totalInvested) * 100

  const positions = activeTab === 'Module Positions' ? mockModulePositions : mockThesisPositions

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-gray-400 mt-1">Track your positions and performance</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Total Invested</span>
          <span className="block text-xl font-bold text-white mt-1">{formatCurrency(totalInvested)}</span>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Current Value</span>
          <span className="block text-xl font-bold text-white mt-1">{formatCurrency(currentValue)}</span>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Total P&L</span>
          <span className={`block text-xl font-bold mt-1 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalPnl)} ({formatPercent(totalPnlPercent)})
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="ml-2 text-xs text-gray-500">
              {tab === 'Module Positions' ? mockModulePositions.length : mockThesisPositions.length}
            </span>
          </button>
        ))}
      </div>

      {/* Position cards */}
      <div className="space-y-3">
        {positions.map((position) => (
          <Link
            key={position.id}
            to={position.type === 'thesis' ? `/thesis/${position.id}` : `/market/${position.id}`}
            className="block bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                position.type === 'thesis' ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-700/50 text-gray-300'
              }`}>
                {position.type}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                position.side === 'YES' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
              }`}>
                {position.side}
              </span>
            </div>
            <h3 className="text-white font-medium mb-3">{position.marketName}</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-gray-500 block">Amount</span>
                <span className="text-sm text-white">{formatCurrency(position.amount)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Avg Price</span>
                <span className="text-sm text-white">{(position.avgPrice * 100).toFixed(0)}¢</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Current</span>
                <span className="text-sm text-white">{(position.currentPrice * 100).toFixed(0)}¢</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">P&L</span>
                <span className={`text-sm ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
