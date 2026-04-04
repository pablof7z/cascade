import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = 'propose-only' | 'trade-with-approval' | 'autonomous'

interface NotificationState {
  newPositionProposals: boolean
  meetingActivity: boolean
  counterEvidenceFound: boolean
  dailyDigest: boolean
  capitalThresholdAlerts: boolean
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="py-8 first:pt-0">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-neutral-400">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Connected Agents ─────────────────────────────────────────────────────────

function ConnectedAgents() {
  return (
    <Section
      title="Connected Agents"
      description="Connect your own agents to participate in field deliberations."
    >
      <div className="flex flex-col gap-4">
        <div className="py-6 text-sm text-neutral-500 border border-neutral-800 text-center">
          No connected agents yet.
        </div>
        <div>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600 transition-colors"
          >
            Connect Agent
          </button>
        </div>
      </div>
    </Section>
  )
}

// ─── Default Permissions ──────────────────────────────────────────────────────

function DefaultPermissions() {
  const [permission, setPermission] = useState<Permission>('propose-only')
  const [capitalLimit, setCapitalLimit] = useState('500')

  const options: { value: Permission; label: string; description: string }[] = [
    {
      value: 'propose-only',
      label: 'Propose only',
      description: 'Agents submit proposals for your review before any action.',
    },
    {
      value: 'trade-with-approval',
      label: 'Trade with approval',
      description: 'Agents can trade once you approve each position.',
    },
    {
      value: 'autonomous',
      label: 'Autonomous within limits',
      description: 'Agents trade freely up to a capital ceiling you set.',
    },
  ]

  return (
    <Section title="Default Permissions">
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <div className="mt-0.5 shrink-0">
              <input
                type="radio"
                name="permission"
                value={opt.value}
                checked={permission === opt.value}
                onChange={() => setPermission(opt.value)}
                className="accent-white"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-200 group-has-[:checked]:text-white">
                {opt.label}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {opt.description}
              </div>
            </div>
          </label>
        ))}

        {permission === 'autonomous' && (
          <div className="mt-2 ml-6 flex items-center gap-3">
            <label className="text-sm text-neutral-400 shrink-0">
              Capital limit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                $
              </span>
              <input
                type="number"
                value={capitalLimit}
                onChange={(e) => setCapitalLimit(e.target.value)}
                className="w-28 pl-6 pr-3 py-1.5 text-sm text-white bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-neutral-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0"
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function Notifications() {
  const [notifs, setNotifs] = useState<NotificationState>({
    newPositionProposals: true,
    meetingActivity: true,
    counterEvidenceFound: true,
    dailyDigest: false,
    capitalThresholdAlerts: false,
  })
  const [thresholdAmount, setThresholdAmount] = useState('100')

  function toggle(key: keyof NotificationState) {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const rows: {
    key: keyof NotificationState
    label: string
    threshold?: boolean
  }[] = [
    { key: 'newPositionProposals', label: 'New position proposals' },
    { key: 'meetingActivity', label: 'Meeting activity' },
    { key: 'counterEvidenceFound', label: 'Counter-evidence found' },
    { key: 'dailyDigest', label: 'Daily digest' },
    { key: 'capitalThresholdAlerts', label: 'Capital threshold alerts', threshold: true },
  ]

  return (
    <Section title="Notifications">
      <div className="flex flex-col gap-3">
        {rows.map(({ key, label, threshold }) => (
          <div key={key}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifs[key]}
                onChange={() => toggle(key)}
                className="accent-white w-4 h-4 shrink-0"
              />
              <span className="text-sm text-neutral-300">{label}</span>
            </label>

            {threshold && notifs[key] && (
              <div className="mt-2 ml-7 flex items-center gap-3">
                <label className="text-sm text-neutral-400 shrink-0">
                  Alert above
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                    $
                  </span>
                  <input
                    type="number"
                    value={thresholdAmount}
                    onChange={(e) => setThresholdAmount(e.target.value)}
                    className="w-28 pl-6 pr-3 py-1.5 text-sm text-white bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-neutral-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── Wallet Management ────────────────────────────────────────────────────────

function WalletManagement() {
  return (
    <Section title="Wallet Management">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between py-3 px-4 bg-neutral-900 border border-neutral-800">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-neutral-500 uppercase tracking-wide">
              Address
            </span>
            <span className="text-sm font-mono text-neutral-500">
              Connect wallet to view address
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-neutral-500 uppercase tracking-wide">
              Balance
            </span>
            <span className="text-sm font-mono text-white">$0.00</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600 transition-colors"
          >
            Fund Wallet
          </button>
        </div>
      </div>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-heading text-white mb-1">Settings</h1>
        <p className="text-sm text-neutral-500 mb-8">
          Manage your agents, permissions, and account preferences.
        </p>

        <div className="divide-y divide-neutral-800/60">
          <ConnectedAgents />
          <DefaultPermissions />
          <Notifications />
          <WalletManagement />
        </div>
      </div>
    </div>
  )
}
