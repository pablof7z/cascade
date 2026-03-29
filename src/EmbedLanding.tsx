import { Link } from 'react-router-dom'
import { useState } from 'react'

// Example embed code for display
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group">
      <pre className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 overflow-x-auto text-sm font-mono text-neutral-300">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-600 transition-colors"
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
        <span className="text-emerald-500 font-bold">{number}</span>
      </div>
      <div>
        <h3 className="text-white font-semibold mb-1">{title}</h3>
        <p className="text-neutral-400 text-sm">{description}</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
        <span className="text-xl">{icon}</span>
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-neutral-400 text-sm">{description}</p>
    </div>
  )
}

function UseCaseCard({ emoji, role, quote }: { emoji: string; role: string; quote: string }) {
  return (
    <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{emoji}</span>
        <span className="text-emerald-500 font-medium">{role}</span>
      </div>
      <p className="text-neutral-300 italic">"{quote}"</p>
    </div>
  )
}

// Demo embed component (simplified inline version)
function DemoEmbed() {
  return (
    <div className="w-full max-w-[380px] bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden shadow-2xl">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white leading-tight mb-3">
          Will Bitcoin exceed $150K by end of 2026?
        </h2>
        <div className="mb-3">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-emerald-400">67%</span>
            <span className="text-xs text-neutral-500">chance</span>
          </div>
          <div className="w-full">
            <div className="h-2 rounded-full overflow-hidden bg-neutral-700">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '67%' }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs">
              <span className="font-medium text-emerald-400">YES 67%</span>
              <span className="font-medium text-rose-400">NO 33%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live
        </div>
      </div>
      <div className="px-4 py-2.5 flex items-center justify-between bg-neutral-800/50 border-t border-neutral-800">
        <span className="text-xs font-medium text-emerald-400">View on Cascade →</span>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#10b981" strokeWidth="2" fill="none" />
            <path d="M10 16L14 20L22 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Powered by Cascade</span>
        </div>
      </div>
    </div>
  )
}

export default function EmbedLanding() {
  const exampleCode = `<iframe
  src="https://cascade.markets/embed/market/YOUR_MARKET_ID"
  width="400"
  height="200"
  frameborder="0"
  style="border-radius: 12px;"
></iframe>`

  const lightThemeCode = `<iframe
  src="https://cascade.markets/embed/market/YOUR_MARKET_ID?theme=light"
  width="400"
  height="200"
  frameborder="0"
></iframe>`

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-500 text-sm mb-4">
                New Feature
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Put Prediction Markets on Your Site
              </h1>
              <p className="text-xl text-neutral-400 mb-8">
                Embed live, real-time prediction markets anywhere. No setup required. 
                Just copy, paste, and let your readers see what the crowd really thinks.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/"
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold rounded-lg transition-colors"
                >
                  Browse Markets
                </Link>
                <a
                  href="#how-it-works"
                  className="px-6 py-3 border border-neutral-700 hover:border-neutral-500 text-white font-medium rounded-lg transition-colors"
                >
                  See How It Works
                </a>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <DemoEmbed />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Embed in 60 Seconds
            </h2>
            <p className="text-lg text-neutral-400">
              Four simple steps to add live prediction markets to your content.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <StepCard 
                number={1}
                title="Find a market on Cascade"
                description="Browse our markets or create your own prediction question."
              />
              <StepCard 
                number={2}
                title="Click the Embed button"
                description="Look for the embed icon on any market page."
              />
              <StepCard 
                number={3}
                title="Copy the iframe code"
                description="We generate the embed code automatically for you."
              />
              <StepCard 
                number={4}
                title="Paste into your site"
                description="Works with Substack, Medium, WordPress, Ghost, or any HTML."
              />
            </div>
            
            <div>
              <div className="text-sm text-neutral-500 mb-3">Example embed code:</div>
              <CodeBlock code={exampleCode} />
              <p className="text-xs text-neutral-500 mt-3">
                Replace YOUR_MARKET_ID with the actual market ID from the URL.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for Content Creators
            </h2>
            <p className="text-lg text-neutral-400">
              Everything you need to enhance your content with live prediction data.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard 
              icon="⚡"
              title="Live Updating"
              description="Prices update automatically as traders buy and sell. Your readers see real-time market sentiment."
            />
            <FeatureCard 
              icon="🎨"
              title="Dark & Light Themes"
              description="Choose the theme that matches your site. Just add ?theme=light to the embed URL."
            />
            <FeatureCard 
              icon="📱"
              title="Responsive Design"
              description="Widgets adapt to any container width. Looks great on mobile, tablet, and desktop."
            />
            <FeatureCard 
              icon="✍️"
              title="Works Everywhere"
              description="Substack, Medium, WordPress, Ghost, Notion, or any platform that supports iframes."
            />
            <FeatureCard 
              icon="🔗"
              title="Links to Full Market"
              description="Readers can click through to trade, see history, and join the discussion."
            />
            <FeatureCard 
              icon="🚀"
              title="Zero Setup"
              description="No API keys, no authentication, no account needed. Just paste and go."
            />
          </div>
        </div>
      </section>

      {/* Theme Options */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Match Your Brand
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                Choose dark mode for tech blogs and newsletters, or light mode for 
                traditional media and clean designs.
              </p>
              <div className="text-sm text-neutral-500 mb-3">Light theme code:</div>
              <CodeBlock code={lightThemeCode} />
            </div>
            <div className="flex flex-col items-center gap-6">
              {/* Light theme demo */}
              <div className="w-full max-w-[380px] bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4">
                  <h2 className="text-sm font-semibold text-neutral-900 leading-tight mb-3">
                    Will AI replace 50% of coding jobs by 2030?
                  </h2>
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-emerald-600">42%</span>
                      <span className="text-xs text-neutral-400">chance</span>
                    </div>
                    <div className="w-full">
                      <div className="h-2 rounded-full overflow-hidden bg-neutral-200">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '42%' }} />
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs">
                        <span className="font-medium text-emerald-600">YES 42%</span>
                        <span className="font-medium text-rose-600">NO 58%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live
                  </div>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between bg-neutral-50 border-t border-neutral-100">
                  <span className="text-xs font-medium text-emerald-600">View on Cascade →</span>
                  <span className="text-xs text-neutral-400">Powered by Cascade</span>
                </div>
              </div>
              <span className="text-sm text-neutral-500">Light theme preview</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-neutral-400">
              See how creators are using embedded prediction markets.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-5">
            <UseCaseCard 
              emoji="📰"
              role="Journalists"
              quote="Embed election odds directly in my coverage. Readers see what the crowd thinks, not just my opinion."
            />
            <UseCaseCard 
              emoji="✍️"
              role="Bloggers"
              quote="I add prediction markets to my tech analysis. It turns speculation into something readers can bet on."
            />
            <UseCaseCard 
              emoji="📊"
              role="Analysts"
              quote="Show my readers exactly where I'm putting my money. Transparency builds trust."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-neutral-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Add Live Markets to Your Content?
          </h2>
          <p className="text-lg text-neutral-400 mb-8">
            Find a market that matches your topic, grab the embed code, and paste it into your next post.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/"
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold rounded-lg transition-colors text-lg"
            >
              Browse Markets
            </Link>
            <Link
              to="/builder"
              className="px-8 py-4 border border-neutral-700 text-white font-medium rounded-lg hover:border-neutral-500 transition-colors text-lg"
            >
              Create a Market
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
