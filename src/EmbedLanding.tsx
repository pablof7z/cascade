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
        <span className="text-xs font-medium text-emerald-400">View on Contrarian →</span>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#10b981" strokeWidth="2" fill="none" />
            <path d="M10 16L14 20L22 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Powered by Contrarian</span>
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
              <span className="text-emerald-500 text-sm font-medium tracking-wide uppercase">
                New Feature
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mt-3 mb-6 leading-tight">
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
      <section id="how-it-works" className="py-16 bg-neutral-900/30">
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
            <ol className="space-y-8">
              {[
                { title: 'Find a market on Contrarian', desc: 'Browse our markets or create your own prediction question.' },
                { title: 'Click the Embed button', desc: 'Look for the embed icon on any market page.' },
                { title: 'Copy the iframe code', desc: 'We generate the embed code automatically for you.' },
                { title: 'Paste into your site', desc: 'Works with Substack, Medium, WordPress, Ghost, or any HTML.' },
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 text-2xl font-bold text-emerald-500/60 tabular-nums leading-7">
                    {i + 1}.
                  </span>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                    <p className="text-neutral-400 text-sm">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            
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

      {/* Features */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for Content Creators
            </h2>
            <p className="text-lg text-neutral-400">
              Everything you need to enhance your content with live prediction data.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {[
              { icon: '⚡', title: 'Live Updating', desc: 'Prices update automatically as traders buy and sell. Your readers see real-time market sentiment.' },
              { icon: '🎨', title: 'Dark & Light Themes', desc: 'Choose the theme that matches your site. Just add ?theme=light to the embed URL.' },
              { icon: '📱', title: 'Responsive Design', desc: 'Widgets adapt to any container width. Looks great on mobile, tablet, and desktop.' },
              { icon: '✍️', title: 'Works Everywhere', desc: 'Substack, Medium, WordPress, Ghost, Notion, or any platform that supports iframes.' },
              { icon: '🔗', title: 'Links to Full Market', desc: 'Readers can click through to trade, see history, and join the discussion.' },
              { icon: '🚀', title: 'Zero Setup', desc: 'No API keys, no authentication, no account needed. Just paste and go.' },
            ].map((f, i) => (
              <div key={i}>
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Theme Options */}
      <section className="py-16 bg-neutral-900/30">
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
              {/* Light theme demo — container is functional, showing actual widget preview */}
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
                  <span className="text-xs font-medium text-emerald-600">View on Contrarian →</span>
                  <span className="text-xs text-neutral-400">Powered by Contrarian</span>
                </div>
              </div>
              <span className="text-sm text-neutral-500">Light theme preview</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-neutral-400">
              See how creators are using embedded prediction markets.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { emoji: '📰', role: 'Journalists', quote: 'Embed election odds directly in my coverage. Readers see what the crowd thinks, not just my opinion.' },
              { emoji: '✍️', role: 'Bloggers', quote: 'I add prediction markets to my tech analysis. It turns speculation into something readers can bet on.' },
              { emoji: '📊', role: 'Analysts', quote: 'Show my readers exactly where I\'m putting my money. Transparency builds trust.' },
            ].map((uc, i) => (
              <div key={i}>
                <span className="text-3xl mb-3 block">{uc.emoji}</span>
                <span className="text-emerald-500 font-medium text-sm uppercase tracking-wide">{uc.role}</span>
                <p className="text-neutral-300 mt-2 italic leading-relaxed">"{uc.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-neutral-900/30">
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
