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
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status]}`}>
      {status === 'active' && '● '}
      {status}
    </span>
  )
}

function AgentCard({ 
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
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'bg-neutral-800/50 border-emerald-500/50'
          : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-xl">
            {agent.avatar}
          </div>
          <div>
            <div className="text-white font-medium">{agent.name}</div>
            <div className="text-xs text-neutral-500">{agent.lastActive}</div>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-neutral-500 text-xs">P&L</div>
          <div className={agent.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
            {agent.pnl >= 0 ? '+' : ''}{formatSats(agent.pnl)} sats
            <span className="text-xs ml-1">({agent.pnlPercent >= 0 ? '+' : ''}{agent.pnlPercent}%)</span>
          </div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs">Balance</div>
          <div className="text-white">{formatSats(agent.balance)} sats</div>
        </div>
      </div>
    </button>
  )
}

function TradeRow({ trade }: { trade: Trade }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 text-xs rounded ${
          trade.side === 'YES' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
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

function ResearchCard({ note }: { note: ResearchNote }) {
  return (
    <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-medium">{note.title}</h4>
        <span className="text-xs text-neutral-500">{note.timestamp}</span>
      </div>
      <p className="text-sm text-neutral-400 mb-3">{note.summary}</p>
      <div className="flex flex-wrap gap-2">
        {note.markets.map(market => (
          <span key={market} className="text-xs px-2 py-1 bg-neutral-800 text-neutral-400 rounded">
            {market}
          </span>
        ))}
      </div>
    </div>
  )
}

function CommandInput({ agentName }: { agentName: string }) {
  const [command, setCommand] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement command handling
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
          
          {/* Portfolio summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Total Balance</div>
              <div className="text-2xl font-bold text-white">{formatSats(totalBalance)} sats</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Total P&L</div>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatSats(totalPnl)} sats
              </div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Active Agents</div>
              <div className="text-2xl font-bold text-white">
                {sampleAgents.filter(a => a.status === 'active').length}/{sampleAgents.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Trades This Month</div>
              <div className="text-2xl font-bold text-white">
                {sampleAgents.reduce((sum, a) => sum + a.tradesThisMonth, 0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Agent list - left sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-4">Your Agents</h2>
            {sampleAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={agent.id === selectedAgentId}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))}
          </div>

          {/* Agent detail - main content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Agent header */}
            <div className="flex items-start justify-between p-6 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-neutral-800 flex items-center justify-center text-3xl">
                  {selectedAgent.avatar}
                </div>
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

            {/* Command input */}
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Direct Your Agent</h3>
              <CommandInput agentName={selectedAgent.name} />
            </div>

            {/* Recent trades */}
            <div className="rounded-xl bg-neutral-900/50 border border-neutral-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
              {agentTrades.length > 0 ? (
                <div>
                  {agentTrades.map(trade => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No trades yet</p>
              )}
            </div>

            {/* Research notes */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Research & Insights</h3>
              {agentResearch.length > 0 ? (
                <div className="space-y-4">
                  {agentResearch.map(note => (
                    <ResearchCard key={note.id} note={note} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                  No research notes from this agent yet
                </p>
              )}
            </div>

            {/* Agent memory/notes - placeholder */}
            <div className="rounded-xl bg-neutral-900/50 border border-neutral-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Agent Memory</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <div className="text-xs text-neutral-500 mb-1">User Preference</div>
                  <div className="text-sm text-neutral-300">Prefers conservative position sizes under 50k sats</div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <div className="text-xs text-neutral-500 mb-1">Market Focus</div>
                  <div className="text-sm text-neutral-300">AI, Technology, Space — avoid political markets</div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <div className="text-xs text-neutral-500 mb-1">Risk Limit</div>
                  <div className="text-sm text-neutral-300">Max 10% drawdown, then pause and alert</div>
                </div>
              </div>
              <button className="mt-4 text-sm text-blue-400 hover:text-blue-300">
                + Add note
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fund modal */}
      {showFundModal && (
        <FundModal agent={selectedAgent} onClose={() => setShowFundModal(false)} />
      )}
    </div>
  )
}
