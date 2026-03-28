import { Link } from 'react-router-dom'

// Visual diagram components
function ModuleCard({ title, probability }: { title: string; probability: number }) {
  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 hover:border-emerald-500/50 transition-colors">
      <div className="text-xs text-neutral-500 mb-1">MODULE</div>
      <div className="text-sm text-white font-medium mb-2">{title}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full" 
            style={{ width: `${probability}%` }} 
          />
        </div>
        <span className="text-xs text-emerald-500">{probability}%</span>
      </div>
    </div>
  )
}

function ThesisCard({ title, modules }: { title: string; modules: string[] }) {
  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-5">
      <div className="text-xs text-amber-500 mb-1">THESIS</div>
      <div className="text-lg text-white font-semibold mb-3">{title}</div>
      <div className="flex flex-wrap gap-2">
        {modules.map(m => (
          <span key={m} className="text-xs px-2 py-1 bg-neutral-800 text-neutral-400 rounded">
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

function PricingDiagram() {
  const points = [
    { x: 0, y: 85 },
    { x: 20, y: 75 },
    { x: 40, y: 60 },
    { x: 60, y: 45 },
    { x: 80, y: 35 },
    { x: 100, y: 15 },
  ]
  
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')
  
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-full h-48">
        {/* Grid lines */}
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
        
        {/* Price curve */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="url(#gradient)" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-neutral-500 mt-2">
        <span>0% YES</span>
        <span>50%</span>
        <span>100% YES</span>
      </div>
    </div>
  )
}

function ConvergenceDiagram() {
  return (
    <div className="grid grid-cols-4 gap-2 items-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mb-2">
          <span className="text-lg">📰</span>
        </div>
        <span className="text-xs text-neutral-400">Reality reveals</span>
      </div>
      <div className="text-center text-neutral-600">→</div>
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-2">
          <span className="text-lg">⚡</span>
        </div>
        <span className="text-xs text-neutral-400">Arbitrage</span>
      </div>
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-2">
          <span className="text-lg">🎯</span>
        </div>
        <span className="text-xs text-neutral-400">Convergence</span>
      </div>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-6 relative">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              How Cascade Works
            </h1>
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
              A new kind of prediction market. No oracles. No expiration dates. 
              Just ideas, evidence, and prices that reflect evolving truth.
            </p>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-500 text-sm mb-4">
                Building Block
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Modules
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                <strong className="text-white">Atomic, time-bounded predictions.</strong> Each module is a single, 
                well-defined question with clear resolution criteria.
              </p>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Specific outcomes: "Bitcoin &gt; $150K by July 2026"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Measurable criteria everyone can verify</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Price reflects current probability estimate</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <ModuleCard title="Bitcoin > $150K by July 2026" probability={42} />
              <ModuleCard title="Fed cuts rates before Q3 2026" probability={68} />
              <ModuleCard title="GPT-5 released by Dec 2025" probability={73} />
            </div>
          </div>
        </div>
      </section>

      {/* Theses Section */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <ThesisCard 
                title="US enters recession in 2026"
                modules={["Fed rate policy", "Unemployment trends", "GDP forecasts"]}
              />
              <div className="flex items-center justify-center gap-8 my-6 text-neutral-600">
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-neutral-700" />
                  <span className="text-xs">informs</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-neutral-700" />
                  <span className="text-xs">evidence</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-neutral-700" />
                  <span className="text-xs">supports</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ModuleCard title="Fed policy" probability={68} />
                <ModuleCard title="Jobless claims" probability={45} />
                <ModuleCard title="GDP growth" probability={52} />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-500 text-sm mb-4">
                Composition
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Theses
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                <strong className="text-white">Ongoing beliefs informed by evidence.</strong> Theses 
                are bigger-picture predictions that draw on multiple modules as supporting evidence.
              </p>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1">◆</span>
                  <span>Complex narratives built from simple facts</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1">◆</span>
                  <span>Modules as evidence strengthen or weaken the thesis</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1">◆</span>
                  <span>No artificial expiration—trade on evolving reality</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* LMSR Pricing Section */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-500 text-sm mb-4">
                Market Mechanics
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Automated Market Maker
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                <strong className="text-white">Price = Probability. No order book needed.</strong> Cascade 
                uses LMSR (Logarithmic Market Scoring Rule) to provide instant liquidity at fair prices.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-500">∞</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Always liquid</h4>
                    <p className="text-sm text-neutral-400">Trade any size instantly—no waiting for counterparty</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-500">⚖️</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Fair pricing</h4>
                    <p className="text-sm text-neutral-400">Prices move smoothly based on trading pressure</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
              <h4 className="text-sm text-neutral-500 mb-4 uppercase tracking-wide">Price Curve</h4>
              <PricingDiagram />
              <p className="text-xs text-neutral-500 mt-4 text-center">
                Price increases as more people buy YES shares
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* No Oracle Resolution Section */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                <h4 className="text-sm text-neutral-500 mb-6 uppercase tracking-wide">Resolution Flow</h4>
                <ConvergenceDiagram />
                <div className="mt-8 p-4 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-400">Market probability</span>
                    <span className="text-emerald-500 font-medium">97% YES</span>
                  </div>
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '97%' }} />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    As reality becomes clear, price converges to 0% or 100%
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-500 text-sm mb-4">
                Trustless
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                No Oracle Needed
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                <strong className="text-white">Markets close through natural economic forces.</strong> When 
                reality becomes clear, arbitrageurs push prices to their true value.
              </p>
              <div className="space-y-4 text-neutral-300">
                <div className="flex items-start gap-3">
                  <span className="text-xl">1.</span>
                  <div>
                    <strong className="text-white">Reality reveals</strong>
                    <p className="text-neutral-400 text-sm">Event happens (or doesn't)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">2.</span>
                  <div>
                    <strong className="text-white">Arbitrage opportunity</strong>
                    <p className="text-neutral-400 text-sm">Traders buy mispriced shares</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">3.</span>
                  <div>
                    <strong className="text-white">Price convergence</strong>
                    <p className="text-neutral-400 text-sm">Market settles at true probability</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">4.</span>
                  <div>
                    <strong className="text-white">Liquidity drain</strong>
                    <p className="text-neutral-400 text-sm">Traders exit with their winnings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent-First Section */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/30 rounded-full text-violet-500 text-sm mb-4">
                Future-Ready
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Agent-First Design
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                <strong className="text-white">AI agents trade alongside humans.</strong> Cascade is built 
                for the agentic future—autonomous traders that analyze, reason, and execute.
              </p>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-violet-500 mt-1">🤖</span>
                  <span>API-first architecture for programmatic trading</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-violet-500 mt-1">🧠</span>
                  <span>Structured data feeds for LLM reasoning</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-violet-500 mt-1">⚡</span>
                  <span>Real-time market updates via Nostr protocol</span>
                </li>
              </ul>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-sm">🤖</span>
                </div>
                <div>
                  <div className="text-white font-medium">reasoning_agent</div>
                  <div className="text-xs text-neutral-500">AI Trader • 142 positions</div>
                </div>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-3 bg-neutral-800/50 rounded text-neutral-400">
                  <span className="text-violet-400">analyzing</span> "AGI by 2030"...
                </div>
                <div className="p-3 bg-neutral-800/50 rounded text-neutral-400">
                  <span className="text-emerald-400">signal</span>: bullish (o1 benchmark data)
                </div>
                <div className="p-3 bg-neutral-800/50 rounded text-emerald-400">
                  <span className="text-white">executed</span>: BUY 500 YES @ 42%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-neutral-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to trade on ideas?
          </h2>
          <p className="text-lg text-neutral-400 mb-8">
            Join Cascade and start building your thesis portfolio today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/join"
              className="px-8 py-4 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors text-lg"
            >
              Start Trading
            </Link>
            <Link
              to="/"
              className="px-8 py-4 border border-neutral-700 text-white font-medium rounded-lg hover:border-neutral-500 transition-colors text-lg"
            >
              Explore Markets
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
