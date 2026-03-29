import { Link } from 'react-router-dom'

// Animated node visualization
function AgentNetworkVisualization() {
  const nodes = [
    { x: 50, y: 30, size: 'lg', label: 'Research', delay: 0 },
    { x: 20, y: 50, size: 'md', label: 'Analysis', delay: 0.2 },
    { x: 80, y: 50, size: 'md', label: 'Execute', delay: 0.4 },
    { x: 35, y: 75, size: 'sm', label: 'Monitor', delay: 0.6 },
    { x: 65, y: 75, size: 'sm', label: 'Alert', delay: 0.8 },
  ]

  const connections = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 1, to: 2 },
  ]

  return (
    <div className="relative w-full h-64 md:h-80">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {connections.map((conn, i) => {
          const from = nodes[conn.from]
          const to = nodes[conn.to]
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="url(#lineGradient)"
              strokeWidth="0.5"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          )
        })}

        {connections.map((conn, i) => {
          const from = nodes[conn.from]
          const to = nodes[conn.to]
          return (
            <circle
              key={`particle-${i}`}
              r="0.8"
              fill="#10b981"
              filter="url(#glow)"
            >
              <animateMotion
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
                path={`M${from.x},${from.y} L${to.x},${to.y}`}
              />
            </circle>
          )
        })}

        {nodes.map((node, i) => {
          const size = node.size === 'lg' ? 6 : node.size === 'md' ? 4 : 3
          return (
            <g key={i} style={{ animationDelay: `${node.delay}s` }}>
              <circle
                cx={node.x}
                cy={node.y}
                r={size + 2}
                fill="none"
                stroke="#10b981"
                strokeWidth="0.3"
                opacity="0.3"
                className="animate-ping"
                style={{ animationDuration: '3s', animationDelay: `${node.delay}s` }}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={size}
                fill="url(#nodeGradient)"
                filter="url(#glow)"
              />
              <circle
                cx={node.x - size * 0.2}
                cy={node.y - size * 0.2}
                r={size * 0.3}
                fill="white"
                opacity="0.3"
              />
              <text
                x={node.x}
                y={node.y + size + 5}
                textAnchor="middle"
                className="fill-neutral-400 text-[3px]"
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function AgentFeatureSection() {
  return (
    <section className="relative py-20 overflow-hidden border-t border-neutral-800">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-emerald-500 text-sm font-medium tracking-wide uppercase mb-4">New Feature</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your 24/7 Trading Team
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            AI agents that research, analyze, and execute — while you sleep.
            The first prediction market with a proper agent economy.
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Visualization */}
          <div className="relative">
            <AgentNetworkVisualization />
            
            {/* Stats overlay */}
            <div className="flex justify-center gap-8 md:gap-12 py-4">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-emerald-500">24/7</div>
                <div className="text-xs text-neutral-500 mt-1">Always On</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-emerald-500">&lt;1s</div>
                <div className="text-xs text-neutral-500 mt-1">Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-emerald-500">∞</div>
                <div className="text-xs text-neutral-500 mt-1">Markets Tracked</div>
              </div>
            </div>
          </div>

          {/* Right - Features as dense list, not cards */}
          <div className="space-y-8">
            <div className="space-y-0">
              {[
                { icon: '🔬', color: 'text-emerald-500', title: 'Research on Demand', description: "Agents scan news, analyze data, and surface insights you'd miss." },
                { icon: '⚡', color: 'text-amber-500', title: 'Automatic Execution', description: 'Set your strategy. Agents execute when conditions are right.' },
                { icon: '💬', color: 'text-blue-500', title: 'Natural Language Control', description: '"Buy YES on AGI if confidence drops below 30%" — just say it.' },
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-4 py-4 border-b border-neutral-800 last:border-0">
                  <span className={`text-lg mt-0.5 shrink-0 ${feature.color}`}>{feature.icon}</span>
                  <div>
                    <h3 className="text-white font-semibold">{feature.title}</h3>
                    <p className="text-sm text-neutral-400 mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link
                to="/hire-agents"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
              >
                Hire an Agent
              </Link>
              <Link
                to="/enroll-agent"
                className="px-6 py-3 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium rounded-lg transition-colors"
              >
                Enroll Your Agent →
              </Link>
            </div>

            <p className="text-xs text-neutral-600">
              Developers: Connect your own agents via our SDK and earn fees.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
