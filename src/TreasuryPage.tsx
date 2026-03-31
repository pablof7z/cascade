// ─── Treasury Page ───────────────────────────────────────────────────────────
// Shows where the user's capital is and what it's doing across all fields
// and agents. All data is mock; a subtle "Sample data" label is shown.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function usd(n: number, decimals = 0): string {
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${n < 0 ? '-' : ''}$${formatted}`
}

function pct(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

function plColor(n: number): string {
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-rose-400'
  return 'text-neutral-400'
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

interface FieldRow {
  id: string
  name: string
  deployed: number
  positions: number
  pnl: number
}

const FIELDS: FieldRow[] = [
  { id: 'f1', name: 'AI & Semiconductors',   deployed: 42_800, positions: 11, pnl:  3_241 },
  { id: 'f2', name: 'Energy Transition',      deployed: 27_500, positions:  7, pnl: -1_087 },
  { id: 'f3', name: 'Global Shipping',        deployed: 18_200, positions:  5, pnl:    614 },
]

interface AgentRow {
  id: string
  name: string
  type: 'Hosted' | 'Connected'
  field: string
  wallet: number
  deployed: number
}

const AGENTS: AgentRow[] = [
  { id: 'a1', name: 'Orion',    type: 'Hosted',    field: 'AI & Semiconductors', wallet: 5_340, deployed: 18_200 },
  { id: 'a2', name: 'Vesper',   type: 'Hosted',    field: 'AI & Semiconductors', wallet: 3_810, deployed: 14_400 },
  { id: 'a3', name: 'Meridian', type: 'Connected', field: 'AI & Semiconductors', wallet: 2_070, deployed: 10_200 },
  { id: 'a4', name: 'Solace',   type: 'Hosted',    field: 'Energy Transition',   wallet: 4_120, deployed: 15_300 },
  { id: 'a5', name: 'Flux',     type: 'Connected', field: 'Energy Transition',   wallet: 1_980, deployed: 12_200 },
]

type Direction = 'Long' | 'Short'

interface Position {
  id: string
  market: string
  field: string
  direction: Direction
  size: number
  entry: number
  current: number
  pnl: number
}

const POSITIONS: Position[] = [
  { id: 'p1', market: 'TSMC Q2 Revenue > $20B',          field: 'AI & Semiconductors', direction: 'Long',  size: 8_400, entry: 0.71, current: 0.84, pnl:  1_092 },
  { id: 'p2', market: 'Nvidia Blackwell Delay > 90 days', field: 'AI & Semiconductors', direction: 'Short', size: 5_200, entry: 0.38, current: 0.29, pnl:    468 },
  { id: 'p3', market: 'ASML EUV Orders Q3 Miss',          field: 'AI & Semiconductors', direction: 'Short', size: 4_100, entry: 0.55, current: 0.61, pnl:   -246 },
  { id: 'p4', market: 'EU Carbon Credits > €80 by Sep',   field: 'Energy Transition',   direction: 'Long',  size: 7_600, entry: 0.62, current: 0.58, pnl:   -304 },
  { id: 'p5', market: 'Offshore Wind GW Target Met 2025', field: 'Energy Transition',   direction: 'Long',  size: 6_300, entry: 0.44, current: 0.49, pnl:    315 },
  { id: 'p6', market: 'Baltic Dry Index > 1800 in Q3',    field: 'Global Shipping',     direction: 'Long',  size: 9_100, entry: 0.67, current: 0.74, pnl:    637 },
  { id: 'p7', market: 'Panama Canal Delay > 30% vessels', field: 'Global Shipping',     direction: 'Short', size: 3_800, entry: 0.31, current: 0.27, pnl:    152 },
  { id: 'p8', market: 'LNG Spot Price Spike > $15/MMBtu', field: 'Energy Transition',   direction: 'Long',  size: 4_200, entry: 0.52, current: 0.49, pnl:   -126 },
]

type TxType = 'Deposit' | 'Withdrawal' | 'Trade'

interface Transaction {
  id: string
  ts: string
  type: TxType
  agent: string
  amount: number
  field: string | null
}

const TRANSACTIONS: Transaction[] = [
  { id: 't01', ts: 'Mar 31, 09:14',  type: 'Trade',      agent: 'Orion',    amount:  1_092, field: 'AI & Semiconductors' },
  { id: 't02', ts: 'Mar 31, 08:47',  type: 'Trade',      agent: 'Flux',     amount:   -304, field: 'Energy Transition'   },
  { id: 't03', ts: 'Mar 31, 07:30',  type: 'Deposit',    agent: 'System',   amount: 10_000, field: null                  },
  { id: 't04', ts: 'Mar 30, 22:15',  type: 'Trade',      agent: 'Meridian', amount:   -246, field: 'AI & Semiconductors' },
  { id: 't05', ts: 'Mar 30, 19:02',  type: 'Trade',      agent: 'Vesper',   amount:    468, field: 'AI & Semiconductors' },
  { id: 't06', ts: 'Mar 30, 14:48',  type: 'Withdrawal', agent: 'System',   amount: -5_000, field: null                  },
  { id: 't07', ts: 'Mar 30, 11:33',  type: 'Trade',      agent: 'Solace',   amount:    315, field: 'Energy Transition'   },
  { id: 't08', ts: 'Mar 29, 20:09',  type: 'Trade',      agent: 'Orion',    amount:    637, field: 'Global Shipping'     },
  { id: 't09', ts: 'Mar 29, 16:21',  type: 'Trade',      agent: 'Flux',     amount:    152, field: 'Global Shipping'     },
  { id: 't10', ts: 'Mar 29, 10:44',  type: 'Trade',      agent: 'Meridian', amount:   -126, field: 'Energy Transition'   },
]

// ─── Derived Summary ──────────────────────────────────────────────────────────

const totalDeployed = FIELDS.reduce((s, f) => s + f.deployed, 0)
const totalPnl      = FIELDS.reduce((s, f) => s + f.pnl, 0)
const agentCash     = AGENTS.reduce((s, a) => s + a.wallet, 0)
const totalCapital  = totalDeployed + agentCash
const totalAvail    = agentCash

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function DirectionBadge({ dir }: { dir: Direction }) {
  const cls =
    dir === 'Long'
      ? 'border-emerald-800 text-emerald-400'
      : 'border-rose-800 text-rose-400'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs border ${cls}`}>
      {dir}
    </span>
  )
}

function TypeBadge({ type }: { type: TxType }) {
  const cls =
    type === 'Deposit'
      ? 'border-neutral-700 text-neutral-300'
      : type === 'Withdrawal'
      ? 'border-neutral-700 text-neutral-400'
      : 'border-neutral-700 text-neutral-500'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs border ${cls}`}>
      {type}
    </span>
  )
}

function ProvBadge({ type }: { type: 'Hosted' | 'Connected' }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-xs border border-neutral-700 text-neutral-500">
      {type}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  return (
    <div className="p-8 space-y-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Treasury</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Capital allocation across all fields and agents.
          </p>
        </div>
        {/* Subtle sample data label */}
        <span className="text-xs text-neutral-600 mt-1">Sample data</span>
      </div>

      {/* ── 1. Summary bar ── */}
      <div className="grid grid-cols-4 gap-px bg-neutral-800 border border-neutral-800">
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Total capital</p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {usd(totalCapital)}
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Deployed</p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {usd(totalDeployed)}
          </p>
          <p className="text-xs text-neutral-600 mt-0.5 tabular-nums">
            {((totalDeployed / totalCapital) * 100).toFixed(0)}% of capital
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Available</p>
          <p className="text-2xl font-semibold text-neutral-300 tabular-nums">
            {usd(totalAvail)}
          </p>
        </div>
        <div className="bg-neutral-950 px-5 py-4">
          <p className="text-xs text-neutral-500 mb-1">Overall P&amp;L</p>
          <p className={`text-2xl font-semibold tabular-nums ${plColor(totalPnl)}`}>
            {usd(totalPnl)}
          </p>
          <p className={`text-xs mt-0.5 tabular-nums ${plColor(totalPnl)}`}>
            {pct((totalPnl / totalCapital) * 100)}
          </p>
        </div>
      </div>

      {/* ── 2. By Field ── */}
      <div>
        <SectionHeading>By Field</SectionHeading>
        <div className="border border-neutral-800">
          {/* Table head */}
          <div className="grid grid-cols-4 gap-px bg-neutral-800">
            <div className="bg-neutral-950 px-5 py-2.5 col-span-1">
              <span className="text-xs text-neutral-500">Field</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Deployed</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Positions</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Net P&amp;L</span>
            </div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-neutral-800">
            {FIELDS.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-4 px-5 py-3.5 hover:bg-neutral-900/40 transition-colors"
              >
                <div className="col-span-1">
                  <span className="text-sm font-medium text-white">{f.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {usd(f.deployed)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {f.positions}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium tabular-nums ${plColor(f.pnl)}`}>
                    {usd(f.pnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. By Agent ── */}
      <div>
        <SectionHeading>By Agent</SectionHeading>
        <div className="border border-neutral-800">
          {/* Table head */}
          <div className="grid grid-cols-5 gap-px bg-neutral-800">
            <div className="bg-neutral-950 px-5 py-2.5 col-span-2">
              <span className="text-xs text-neutral-500">Agent</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Wallet</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Deployed</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Available</span>
            </div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-neutral-800">
            {AGENTS.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-5 px-5 py-3.5 hover:bg-neutral-900/40 transition-colors"
              >
                <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-neutral-300">
                      {a.name[0]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{a.name}</span>
                      <ProvBadge type={a.type} />
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{a.field}</p>
                  </div>
                </div>
                <div className="text-right self-center">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {usd(a.wallet)}
                  </span>
                </div>
                <div className="text-right self-center">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {usd(a.deployed)}
                  </span>
                </div>
                <div className="text-right self-center">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {usd(a.wallet)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Open Positions ── */}
      <div>
        <SectionHeading>Open Positions</SectionHeading>
        <div className="border border-neutral-800">
          {/* Table head */}
          <div className="grid grid-cols-[2fr_1fr_80px_88px_88px_88px_88px] gap-px bg-neutral-800">
            <div className="bg-neutral-950 px-5 py-2.5">
              <span className="text-xs text-neutral-500">Market</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5">
              <span className="text-xs text-neutral-500">Field</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5">
              <span className="text-xs text-neutral-500">Direction</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Size</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Entry</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">Current</span>
            </div>
            <div className="bg-neutral-950 px-5 py-2.5 text-right">
              <span className="text-xs text-neutral-500">P&amp;L</span>
            </div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-neutral-800">
            {POSITIONS.map((pos) => (
              <div
                key={pos.id}
                className="grid grid-cols-[2fr_1fr_80px_88px_88px_88px_88px] px-5 py-3 hover:bg-neutral-900/40 transition-colors items-center"
              >
                <div className="min-w-0 pr-4">
                  <span className="text-sm text-neutral-200 leading-snug line-clamp-1">
                    {pos.market}
                  </span>
                </div>
                <div className="min-w-0 pr-2">
                  <span className="text-xs text-neutral-500 truncate block">
                    {pos.field}
                  </span>
                </div>
                <div>
                  <DirectionBadge dir={pos.direction} />
                </div>
                <div className="text-right">
                  <span className="text-sm text-neutral-300 tabular-nums">
                    {usd(pos.size)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-neutral-400 tabular-nums font-mono">
                    {pos.entry.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-neutral-300 tabular-nums font-mono">
                    {pos.current.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium tabular-nums ${plColor(pos.pnl)}`}>
                    {usd(pos.pnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Recent Transactions ── */}
      <div>
        <SectionHeading>Recent Transactions</SectionHeading>
        <div className="divide-y divide-neutral-800 border border-neutral-800">
          {TRANSACTIONS.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-900/40 transition-colors"
            >
              {/* Timestamp */}
              <span className="text-xs text-neutral-600 tabular-nums shrink-0 w-32">
                {tx.ts}
              </span>

              {/* Type badge */}
              <div className="shrink-0">
                <TypeBadge type={tx.type} />
              </div>

              {/* Agent */}
              <span className="text-sm text-neutral-300 shrink-0 w-20">
                {tx.agent}
              </span>

              {/* Field context */}
              <span className="text-xs text-neutral-600 flex-1 truncate">
                {tx.field ?? '—'}
              </span>

              {/* Amount */}
              <span
                className={`text-sm font-medium tabular-nums shrink-0 ${
                  tx.type === 'Withdrawal'
                    ? 'text-rose-400'
                    : tx.type === 'Deposit'
                    ? 'text-neutral-300'
                    : plColor(tx.amount)
                }`}
              >
                {tx.type === 'Withdrawal'
                  ? usd(tx.amount)
                  : tx.amount >= 0
                  ? `+${usd(tx.amount)}`
                  : usd(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
