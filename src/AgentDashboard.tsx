import { useState } from 'react'
import { Link } from 'react-router-dom'

// Types
type AgentStatus = 'active' | 'paused' | 'error'

type Agent = {
  id: string
  name: string
  avatar: string
  status: AgentStatus
  pnl: number
  pnlPercent: number
  balance: number
  tradesThisMonth: number
  lastActive: string
  strategy: string
}

type Trade = {
  id: string
  agentId: string
  market: string
  side: 'YES' | 'NO'
  amount: number
  price: number
  timestamp: string
  pnl?: number
}

type ResearchNote = {
  id: string
  agentId: string
  title: string
  summary: string
  timestamp: string
  markets: string[]
}

// Sample data
const sampleAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Alpha Seeker',
    avatar: '🔮',
    status: 'active',
    pnl: 45200,
    pnlPercent: 12.4,
    balance: 500000,
    tradesThisMonth: 47,
    lastActive: '2 min ago',
    strategy: 'Momentum-based, focuses on AI and tech markets',
  },
  {
    id: 'agent-2',
    name: 'Risk Manager',
    avatar: '🛡️',
    status: 'active',
    pnl: 18900,
    pnlPercent: 5.2,
    balance: 250000,
    tradesThisMonth: 23,
    lastActive: '15 min ago',
    strategy: 'Conservative, hedged positions across sectors',
  },
  {
    id: 'agent-3',
    name: 'News Tracker',
    avatar: '📰',
    status: 'paused',
    pnl: -8500,
    pnlPercent: -3.1,
    balance: 150000,
    tradesThisMonth: 12,
    lastActive: '2 hours ago',
    strategy: 'Event-driven, reacts to breaking news',
  },
]

const sampleTrades: Trade[] = [
  { id: 't1', agentId: 'agent-1', market: 'AGI by 2030', side: 'YES', amount: 25000, price: 0.42, timestamp: '2 min ago', pnl: 1200 },
  { id: 't2', agentId: 'agent-1', market: 'Fed Rate Cut Q3', side: 'NO', amount: 15000, price: 0.68, timestamp: '15 min ago', pnl: -500 },
  { id: 't3', agentId: 'agent-2', market: 'BTC > $150K', side: 'YES', amount: 10000, price: 0.35, timestamp: '1 hour ago', pnl: 800 },
  { id: 't4', agentId: 'agent-1', market: 'Mars Landing 2035', side: 'YES', amount: 20000, price: 0.28, timestamp: '2 hours ago' },
  { id: 't5', agentId: 'agent-2', market: 'Fusion Power 2030', side: 'NO', amount: 8000, price: 0.72, timestamp: '3 hours ago', pnl: 320 },
]

const sampleResearch: ResearchNote[] = [
  {
    id: 'r1',
    agentId: 'agent-1',
    title: 'OpenAI GPT-5 Timeline Analysis',
    summary: 'Based on hiring patterns and compute scaling, GPT-5 likely Q2 2026. This strengthens AGI by 2030 thesis. Recommend increasing YES position.',
    timestamp: '1 hour ago',
    markets: ['AGI by 2030', 'AI Automation'],
  },
  {
    id: 'r2',
    agentId: 'agent-2',
    title: 'Fed Minutes Deep Dive',
    summary: 'FOMC minutes suggest dovish tilt. 70% probability of rate cut by Q3. Current market pricing seems efficient at 68%.',
    timestamp: '4 hours ago',
    markets: ['Fed Rate Cut Q3', 'US Recession 2026'],
  },
  {
    id: 'r3',
    agentId: 'agent-3',
    title: 'SpaceX Starship Update',
    summary: 'Flight 7 data shows improved heat shield performance. Increases Mars landing probability. News impact: +3% on Mars markets.',
    timestamp: '6 hours ago',
    markets: ['Mars Landing 2035', 'Space Economy $1T'],
  },
]

// Helper functions
function formatSats(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
  return value.toString()
}

// Components
function StatusBadge({ status }: { status: AgentStatus }) {
  const styles = {
    active: 'text-emerald-400',
    paused: 'text-amber-400',
    error: 'text-red-400',
  }
  
  return (
    <span className={`text-xs font-medium ${styles[status]}`}>
      {status === 'active' && '● '}
      {status === 'paused' && '◐ '}
      {status === 'error' && '✕ '}
      {status}
    </span>
  )
}

function AgentRow({ 
  agent, 
  isSelected, 
  onClick 
}: { 
  agent: Agent
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left py-4 border-b border-neutral-800 last:border-0 transition-colors ${
        isSelected
          ? 'bg-neutral-900/50'
          : 'hover:bg-neutral-900/30'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-3">
          <span className="text-xl">{agent.avatar}</span>
          <div>
            <span className="text-white font-medium">{agent.name}</span>
            <span className="text-neutral-600 mx-2">·</span>
            <span className="text-xs text-neutral-500">{agent.lastActive}</span>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      
      <div className="flex items-center gap-6 pl-9 text-sm">
        <div>
          <span className="text-neutral-500 text-xs mr-1.5">P&L</span>
          <span className={agent.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
            {agent.pnl >= 0 ? '+' : ''}{formatSats(agent.pnl)}
            <span className="text-xs ml-1">({agent.pnlPercent >= 0 ? '+' : ''}{agent.pnlPercent}%)</span>
          </span>
        </div>
        <div>
          <span className="text-neutral-500 text-xs mr-1.5">Bal</span>
          <span className="text-white">{formatSats(agent.balance)}</span>
        </div>
      </div>
    </button>
  )
}

function TradeRow({ trade }: { trade: Trade }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium w-7 ${
          trade.side === 'YES' ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {trade.side}
        </span>
        <div>
          <div className="text-sm text-white">{trade.market}</div>
          <div className="text-xs text-neutral-500">{trade.timestamp}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-white">{formatSats(trade.amount)} sats</div>
        {trade.pnl !== undefined && (
          <div className={`text-xs ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trade.pnl >= 0 ? '+' : ''}{formatSats(trade.pnl)}
          </div>
        )}
      </div>
    </div>
  )
}

function CommandInput({ agentName }: { agentName: string }) {
  const [command, setCommand] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Command:', command)
    setCommand('')
  }
  
  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder={`Direct ${agentName}... (e.g., "Focus on AI markets")`}
        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
      >
        Send
      </button>
    </form>
  )
}

function FundModal({ 
  agent, 
  onClose 
}: { 
  agent: Agent
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80" onClick={onClose}>
      <div className="w-full max-w-md p-6 bg-neutral-900 border border-neutral-800 rounded-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-white mb-4">Fund {agent.name}</h3>
        <p className="text-sm text-neutral-400 mb-6">
          Current balance: <span className="text-white">{formatSats(agent.balance)} sats</span>
        </p>
        
        <label className="block mb-4">
          <span className="text-sm text-neutral-400 block mb-2">Amount (sats)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100000"
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
          />
        </label>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500"
          >
            Cancel
          </button>
          <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg">
            Fund Agent
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentDashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(sampleAgents[0].id)
  const [showFundModal, setShowFundModal] = useState(false)
  
  const selectedAgent = sampleAgents.find(a => a.id === selectedAgentId)!
  const agentTrades = sampleTrades.filter(t => t.agentId === selectedAgentId)
  const agentResearch = sampleResearch.filter(r => r.agentId === selectedAgentId)
  
  // Calculate totals
  const totalBalance = sampleAgents.reduce((sum, a) => sum + a.balance, 0)
  const totalPnl = sampleAgents.reduce((sum, a) => sum + a.pnl, 0)
  
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <section className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Agent Dashboard</h1>
              <p className="text-neutral-400">Manage your AI trading agents</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/hire-agents"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
              >
                + Hire Agent
              </Link>
            </div>
          </div>
          
          {/* Portfolio summary — horizontal ticker-tape style */}
          <div className="flex flex-wrap items-baseline gap-8 mt-8 pt-6 border-t border-neutral-800">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide mr-2">Balance</span>
              <span className="text-2xl font-bold text-white">{formatSats(totalBalance)} sats</span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide mr-2">P&L</span>
              <span className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatSats(totalPnl)} sats
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide mr-2">Active</span>
              <span className="text-2xl font-bold text-white">
                {sampleAgents.filter(a => a.status === 'active').length}/{sampleAgents.length}
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide mr-2">Trades</span>
              <span className="text-2xl font-bold text-white">
                {sampleAgents.reduce((sum, a) => sum + a.tradesThisMonth, 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Agent list — left sidebar */}
          <div className="lg:col-span-4">
            <h2 className="text-lg font-semibold text-white mb-2">Your Agents</h2>
            {sampleAgents.map(agent => (
              <AgentRow
                key={agent.id}
                agent={agent}
                isSelected={agent.id === selectedAgentId}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))}
          </div>

          {/* Agent detail — main content */}
          <div className="lg:col-span-8 space-y-8">
            {/* Agent header */}
            <div className="border-b border-neutral-800 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{selectedAgent.avatar}</span>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-white">{selectedAgent.name}</h2>
                      <StatusBadge status={selectedAgent.status} />
                    </div>
                    <p className="text-sm text-neutral-400 mt-1">{selectedAgent.strategy}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFundModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Fund
                  </button>
                  <button className="px-4 py-2 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-sm rounded-lg transition-colors">
                    {selectedAgent.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            </div>

            {/* Command input */}
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Direct Your Agent</h3>
              <CommandInput agentName={selectedAgent.name} />
            </div>

            {/* Recent trades — clean table */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
              {agentTrades.length > 0 ? (
                <div>
                  {agentTrades.map(trade => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 py-4">No trades yet</p>
              )}
            </div>

            {/* Research notes — dense list */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Research & Insights</h3>
              {agentResearch.length > 0 ? (
                <div>
                  {agentResearch.map(note => (
                    <div key={note.id} className="py-4 border-b border-neutral-800 last:border-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-white font-medium">{note.title}</h4>
                        <span className="text-xs text-neutral-500 shrink-0 ml-4">{note.timestamp}</span>
                      </div>
                      <p className="text-sm text-neutral-400 mb-2">{note.summary}</p>
                      <div className="flex flex-wrap gap-2">
                        {note.markets.map(market => (
                          <span key={market} className="text-xs text-neutral-500">#{market.replace(/\s+/g, '')}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 py-4">
                  No research notes from this agent yet
                </p>
              )}
            </div>

            {/* Agent memory/notes */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Agent Memory</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap align-top">User Preference</td>
                    <td className="py-3 text-neutral-300">Prefers conservative position sizes under 50k sats</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap align-top">Market Focus</td>
                    <td className="py-3 text-neutral-300">AI, Technology, Space — avoid political markets</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap align-top">Risk Limit</td>
                    <td className="py-3 text-neutral-300">Max 10% drawdown, then pause and alert</td>
                  </tr>
                </tbody>
              </table>
              <button className="mt-3 text-sm text-blue-400 hover:text-blue-300">
                + Add note
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fund modal — acceptable: interactive container */}
      {showFundModal && (
        <FundModal agent={selectedAgent} onClose={() => setShowFundModal(false)} />
      )}
    </div>
  )
}
