import { Link } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { FieldAgent, AgentProvisioning, FieldAgentStatus } from './fieldTypes'

type AgentRow = FieldAgent & {
  fieldId: string
  fieldName: string
  lastActive: string
}

const LAST_ACTIVE: Record<string, string> = {
  'ai-agent-1': '4 min ago',
  'ai-agent-2': '11 min ago',
  'ai-agent-3': '38 min ago',
  'energy-agent-1': '19 min ago',
  'energy-agent-2': '1 hr ago',
  'energy-agent-3': '22 min ago',
  'shipping-agent-1': '57 min ago',
  'shipping-agent-2': '1 hr ago',
}

const STATUS_LABEL: Record<FieldAgentStatus, string> = {
  active: 'Active',
  challenging: 'Active',
  monitoring: 'Idle',
}

const STATUS_DOT: Record<FieldAgentStatus, string> = {
  active: 'bg-emerald-500',
  challenging: 'bg-emerald-500',
  monitoring: 'bg-neutral-600',
}

const STATUS_TEXT: Record<FieldAgentStatus, string> = {
  active: 'text-emerald-400',
  challenging: 'text-emerald-400',
  monitoring: 'text-neutral-400',
}

const PROVISIONING_LABEL: Record<AgentProvisioning, string> = {
  hosted: 'Hosted',
  connected: 'Connected',
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-neutral-300 tracking-wide">
        {initials.toUpperCase()}
      </span>
    </div>
  )
}

function ProvisioningBadge({ type }: { type: AgentProvisioning }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-xs border ${
        type === 'hosted'
          ? 'border-neutral-600 text-neutral-400'
          : 'border-neutral-700 text-neutral-500'
      }`}
    >
      {PROVISIONING_LABEL[type]}
    </span>
  )
}

export default function AgentsPage() {
  const workspace = loadFieldWorkspace()

  const agents: AgentRow[] = workspace.fields.flatMap((field) =>
    field.council.map((agent) => ({
      ...agent,
      fieldId: field.id,
      fieldName: field.name,
      lastActive: LAST_ACTIVE[agent.id] ?? 'recently',
    }))
  )

  const totalAgents = agents.length
  const activeCount = agents.filter(
    (a) => a.status === 'active' || a.status === 'challenging'
  ).length
  const idleCount = agents.filter((a) => a.status === 'monitoring').length
  const totalCapital = agents.reduce((sum, a) => sum + a.wallet.balanceUsd, 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-base font-semibold text-white">Agents</h1>
          <p className="mt-1 text-sm text-neutral-400">
            AI agents working across your fields.
          </p>
        </div>
        <Link
          to="/hire-agents"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Hire Agent
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-px bg-neutral-800 border border-neutral-800 mb-8">
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Total agents</p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {totalAgents}
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Active</p>
          <p className="text-2xl font-semibold text-emerald-400 tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Idle</p>
          <p className="text-2xl font-semibold text-neutral-300 tabular-nums">
            {idleCount}
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Capital deployed</p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {formatUsd(totalCapital)}
          </p>
        </div>
      </div>

      {/* Agent list */}
      <div className="divide-y divide-neutral-800 border border-neutral-800">
        {agents.map((agent) => (
          <div
            key={`${agent.fieldId}-${agent.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-900/40 transition-colors"
          >
            {/* Avatar */}
            <Initials name={agent.name} />

            {/* Name + role + focus */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-white">
                  {agent.name}
                </span>
                <ProvisioningBadge type={agent.provisioning} />
              </div>
              <p className="text-xs text-neutral-400">{agent.role}</p>
              <p className="text-xs text-neutral-600 mt-1 truncate">
                {agent.focus}
              </p>
            </div>

            {/* Field assignment */}
            <div className="shrink-0 hidden sm:block min-w-[160px]">
              <p className="text-xs text-neutral-500 mb-0.5">Field</p>
              <p className="text-xs text-neutral-300">{agent.fieldName}</p>
            </div>

            {/* Wallet */}
            <div className="text-right shrink-0 min-w-[80px]">
              <p className="text-xs text-neutral-500 mb-0.5">Wallet</p>
              <p className="text-sm font-medium text-white tabular-nums">
                {formatUsd(agent.wallet.balanceUsd)}
              </p>
            </div>

            {/* Status */}
            <div className="text-right shrink-0 min-w-[72px]">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[agent.status]}`}
                />
                <span
                  className={`text-xs font-medium ${STATUS_TEXT[agent.status]}`}
                >
                  {STATUS_LABEL[agent.status]}
                </span>
              </div>
              <p className="text-xs text-neutral-600">{agent.lastActive}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-400 border border-neutral-700 hover:text-white hover:border-neutral-600 transition-colors"
              >
                Assign to Field
              </button>
              <button
                type="button"
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-400 border border-neutral-700 hover:text-white hover:border-neutral-600 transition-colors"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
