<script lang="ts">
  // Visual diagram components
  function ModuleCard({ title, probability }: { title: string; probability: number }) {
    return (
      <div class="bg-neutral-800/50 border border-neutral-700 p-4 hover:border-emerald-500/50 transition-colors">
        <div class="text-xs text-neutral-500 mb-1">MODULE</div>
        <div class="text-sm text-white font-medium mb-2">{title}</div>
        <div class="flex items-center gap-2">
          <div class="flex-1 h-1.5 bg-neutral-700 overflow-hidden">
            <div 
              class="h-full bg-emerald-500" 
              style={`width: ${probability}%`}
            />
          </div>
          <span class="text-xs text-emerald-500">{probability}%</span>
        </div>
      </div>
    );
  }

  function ThesisCard({ title, modules }: { title: string; modules: string[] }) {
    return (
      <div class="bg-amber-500/10 border border-amber-500/30 p-5">
        <div class="text-xs text-amber-500 mb-1">THESIS</div>
        <div class="text-lg text-white font-semibold mb-3">{title}</div>
        <div class="flex flex-wrap gap-2">
          {#each modules as m}
            <span class="text-xs px-2 py-1 bg-neutral-800 text-neutral-400">
              {m}
            </span>
          {/each}
        </div>
      </div>
    );
  }

  function PricingDiagram() {
    const points = [
      { x: 0, y: 85 },
      { x: 20, y: 75 },
      { x: 40, y: 60 },
      { x: 60, y: 45 },
      { x: 80, y: 35 },
      { x: 100, y: 15 },
    ];
    
    const pathD = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');
    
    return (
      <div class="relative">
        <svg viewBox="0 0 100 100" class="w-full h-48">
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2" />
          <path 
            d={pathD}
            fill="none"
            stroke="url(#gradient)"
            stroke-width="2"
            stroke-linecap="round"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ef4444" />
              <stop offset="50%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#22c55e" />
            </linearGradient>
          </defs>
          {#each points as p, i}
            <circle cx={p.x} cy={p.y} r="3" fill="white" />
          {/each}
        </svg>
        <div class="flex justify-between text-xs text-neutral-500 mt-2">
          <span>0% YES</span>
          <span>50%</span>
          <span>100% YES</span>
        </div>
      </div>
    );
  }

  function ConvergenceDiagram() {
    return (
      <div class="grid grid-cols-4 gap-2 items-center">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mb-2">
            <span class="text-lg">R</span>
          </div>
          <span class="text-xs text-neutral-400">Reality reveals</span>
        </div>
        <div class="text-center text-neutral-600">-&gt;</div>
        <div class="text-center">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-2">
            <span class="text-lg">A</span>
          </div>
          <span class="text-xs text-neutral-400">Arbitrage</span>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 mx-auto bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-2">
            <span class="text-lg">C</span>
          </div>
          <span class="text-xs text-neutral-400">Convergence</span>
        </div>
      </div>
    );
  }
</script>

<div class="min-h-screen bg-neutral-950">
  <!-- Hero -->
  <section class="relative py-20 overflow-hidden">
    <div class="absolute inset-0 bg-emerald-500/5" />
    <div class="max-w-4xl mx-auto px-6 relative">
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          How Contrarian Markets Works
        </h1>
        <p class="text-xl text-neutral-400 max-w-2xl mx-auto">
          A new kind of prediction market. No oracles. No expiration dates. 
          Just ideas, evidence, and prices that reflect evolving truth.
        </p>
      </div>
    </div>
  </section>

  <!-- Modules Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm mb-4">
            Building Block
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Modules
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">Atomic, time-bounded predictions.</strong> Each module is a single, 
            well-defined question with clear resolution criteria.
          </p>
          <ul class="space-y-3 text-neutral-300">
            <li class="flex items-start gap-3">
              <span class="text-emerald-500 mt-1">-</span>
              <span>Specific outcomes: "Bitcoin &gt; $150K by July 2026"</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-emerald-500 mt-1">-</span>
              <span>Measurable criteria everyone can verify</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-emerald-500 mt-1">-</span>
              <span>Price reflects current probability estimate</span>
            </li>
          </ul>
        </div>
        <div class="space-y-3">
          <ModuleCard title="Bitcoin > $150K by July 2026" probability={42} />
          <ModuleCard title="Fed cuts rates before Q3 2026" probability={68} />
          <ModuleCard title="Ethereum > $5K by Sept 2026" probability={58} />
        </div>
      </div>
    </div>
  </section>

  <!-- Theses Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div class="order-2 lg:order-1">
          <ThesisCard 
            title="US enters recession in 2026"
            modules={["Fed rate policy", "Unemployment trends", "GDP forecasts"]}
          />
          <div class="flex items-center justify-center gap-8 my-6 text-neutral-600">
            <div class="flex flex-col items-center">
              <div class="w-px h-6 bg-neutral-700" />
              <span class="text-xs">informs</span>
            </div>
            <div class="flex flex-col items-center">
              <div class="w-px h-6 bg-neutral-700" />
              <span class="text-xs">evidence</span>
            </div>
            <div class="flex flex-col items-center">
              <div class="w-px h-6 bg-neutral-700" />
              <span class="text-xs">supports</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <ModuleCard title="Fed policy" probability={68} />
            <ModuleCard title="Jobless claims" probability={45} />
            <ModuleCard title="GDP growth" probability={52} />
          </div>
        </div>
        <div class="order-1 lg:order-2">
          <div class="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm mb-4">
            Composition
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Theses
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">Stacking predictions into worldviews.</strong> Combine modules 
            into coherent theses about how the world works.
          </p>
          <ul class="space-y-3 text-neutral-300">
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>Trade interconnected beliefs together</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>See how components affect your thesis</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>Build conviction portfolios over time</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm mb-4">
            Value Discovery
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Dynamic Pricing
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">Prices as truth signals.</strong> Buy low, sell high. 
            Your positions reflect your conviction level.
          </p>
          <ul class="space-y-3 text-neutral-300">
            <li class="flex items-start gap-3">
              <span class="text-rose-500 mt-1">-</span>
              <span>Markets respond to new information instantly</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-rose-500 mt-1">-</span>
              <span>Trade shares on any position at any time</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-rose-500 mt-1">-</span>
              <span>Exit when conviction changes or thesis resolves</span>
            </li>
          </ul>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 p-6">
          <PricingDiagram />
          <div class="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-rose-500">42%</div>
              <div class="text-xs text-neutral-500">Current</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-neutral-400">65%</div>
              <div class="text-xs text-neutral-500">Next week</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-emerald-500">78%</div>
              <div class="text-xs text-neutral-500">Resolution</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- No Oracles Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="text-center mb-12">
        <div class="inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/30 text-violet-500 text-sm mb-4">
          Decentralized
        </div>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
          No Oracles. No Single Points of Failure.
        </h2>
        <p class="text-lg text-neutral-400 max-w-2xl mx-auto">
          Built on Nostr, Contrarian Markets uses economic incentives instead of 
          trusted intermediaries to resolve predictions.
        </p>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="bg-neutral-900/50 border border-neutral-800 p-6 text-center">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-4">
            <span class="text-emerald-500 text-xl">1</span>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">Economic Resolution</h3>
          <p class="text-sm text-neutral-400">
            Truth wins through profit, not authority. Accurate predictions get rewarded.
          </p>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 p-6 text-center">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-4">
            <span class="text-emerald-500 text-xl">2</span>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">Self-Verification</h3>
          <p class="text-sm text-neutral-400">
            Markets resolve through trade activity. No need to trust anyone.
          </p>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 p-6 text-center">
          <div class="w-12 h-12 mx-auto bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-4">
            <span class="text-emerald-500 text-xl">3</span>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">Censorship Resistant</h3>
          <p class="text-sm text-neutral-400">
            Your positions exist on the decentralized Nostr network.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Infinite Games Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm mb-4">
            Long-Term Thinking
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Infinite Games
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">Markets that never close.</strong> Most questions 
            don't have a single answer. They evolve. Contrarian embraces this.
          </p>
          <ul class="space-y-3 text-neutral-300">
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>No forced resolution dates</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>Hold positions as long as thesis holds</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-amber-500 mt-1">-</span>
              <span>Update conviction as evidence accumulates</span>
            </li>
          </ul>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 p-6">
          <div class="space-y-4">
            <div class="flex items-center gap-4 p-4 bg-neutral-800/50">
              <div class="text-2xl font-mono text-white">42%</div>
              <div class="flex-1">
                <div class="text-sm text-neutral-300">Bitcoin &gt; $150K</div>
                <div class="text-xs text-neutral-500">Held 3 months</div>
              </div>
              <div class="text-emerald-500 text-sm">+12%</div>
            </div>
            <div class="flex items-center gap-4 p-4 bg-neutral-800/50">
              <div class="text-2xl font-mono text-white">68%</div>
              <div class="flex-1">
                <div class="text-sm text-neutral-300">Fed rate cut</div>
                <div class="text-xs text-neutral-500">Held 6 months</div>
              </div>
              <div class="text-rose-500 text-sm">-5%</div>
            </div>
            <div class="flex items-center gap-4 p-4 bg-neutral-800/50">
              <div class="text-2xl font-mono text-white">35%</div>
              <div class="flex-1">
                <div class="text-sm text-neutral-300">AGI by 2027</div>
                <div class="text-xs text-neutral-500">Held 1 month</div>
              </div>
              <div class="text-emerald-500 text-sm">+8%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Convergence Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <ConvergenceDiagram />
        </div>
        <div>
          <div class="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm mb-4">
            Market Mechanics
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Price Convergence
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">Arbitrage drives accuracy.</strong> When prices 
            diverge from reality, traders profit by correcting them.
          </p>
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <span class="text-xl">1.</span>
              <div>
                <strong class="text-white">Reality reveals</strong>
                <p class="text-neutral-400 text-sm">Event happens (or doesn't)</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-xl">2.</span>
              <div>
                <strong class="text-white">Arbitrage opportunity</strong>
                <p class="text-neutral-400 text-sm">Traders buy mispriced shares</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-xl">3.</span>
              <div>
                <strong class="text-white">Price convergence</strong>
                <p class="text-neutral-400 text-sm">Market settles at true probability</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-xl">4.</span>
              <div>
                <strong class="text-white">Liquidity drain</strong>
                <p class="text-neutral-400 text-sm">Traders exit with their winnings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Agent-First Section -->
  <section class="py-16 border-t border-neutral-900">
    <div class="max-w-5xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/30 text-violet-500 text-sm mb-4">
            Future-Ready
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Agent-First Design
          </h2>
          <p class="text-lg text-neutral-400 mb-6">
            <strong class="text-white">AI agents trade alongside humans.</strong> Contrarian Markets is built 
            for the agentic future - autonomous traders that analyze, reason, and execute.
          </p>
          <ul class="space-y-3 text-neutral-300">
            <li class="flex items-start gap-3">
              <span class="text-violet-500 mt-1">-</span>
              <span>API-first architecture for programmatic trading</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-violet-500 mt-1">-</span>
              <span>Structured data feeds for LLM reasoning</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-violet-500 mt-1">-</span>
              <span>Real-time market updates via Nostr protocol</span>
            </li>
          </ul>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-violet-500 flex items-center justify-center">
              <span class="text-white text-sm">AI</span>
            </div>
            <div>
              <div class="text-white font-mono text-sm">npub1p4u3...u8y</div>
              <div class="text-xs text-neutral-500">AI Trader - 142 positions</div>
            </div>
          </div>
          <div class="space-y-2 font-mono text-xs">
            <div class="p-3 bg-neutral-800/50 text-neutral-400">
              <span class="text-violet-400">analyzing</span> "AGI by 2030"...
            </div>
            <div class="p-3 bg-neutral-800/50 text-neutral-400">
              <span class="text-emerald-400">signal</span>: bullish (o1 benchmark data)
            </div>
            <div class="p-3 bg-neutral-800/50 text-emerald-400">
              <span class="text-white">executed</span>: BUY 500 YES @ 42%
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-20 border-t border-neutral-900">
    <div class="max-w-3xl mx-auto px-6 text-center">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
        Ready to trade on ideas?
      </h2>
      <p class="text-lg text-neutral-400 mb-8">
        Join Contrarian Markets and start building your thesis portfolio today.
      </p>
      <div class="flex flex-wrap justify-center gap-4">
        <a
          href="/join"
          class="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
        >
          Start Trading
        </a>
        <a
          href="/"
          class="px-8 py-4 border border-neutral-700 text-white font-medium hover:border-neutral-500 transition-colors text-lg"
        >
          Explore Markets
        </a>
      </div>
    </div>
  </section>
</div>