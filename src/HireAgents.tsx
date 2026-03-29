import { useState } from 'react'
import { Link } from 'react-router-dom'

// Pricing tier type
type PricingTier = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Basic',
    price: '10k',
    period: 'sats/month',
    description: 'Perfect for getting started with AI-assisted trading.',
    features: [
      '1 AI agent',
      '50 trades per month',
      'Basic market research',
      'Daily market summaries',
      'Email alerts',
    ],
    cta: 'Start Basic',
  },
  {
    name: 'Pro',
    price: '50k',
    period: 'sats/month',
    description: 'For serious traders who want an edge.',
    features: [
      '3 AI agents',
      'Unlimited trades',
      'Advanced research & analysis',
      'Priority execution',
      'Real-time alerts',
      'Custom strategies',
      'Natural language commands',
    ],
    cta: 'Go Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'Dedicated agents built for your needs.',
    features: [
      'Unlimited custom agents',
      'Dedicated infrastructure',
      'Custom model training',
      'API access',
      'Priority support',
      'SLA guarantees',
      'White-label options',
    ],
    cta: 'Contact Sales',
  },
]

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        className="w-full py-5 flex items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <span className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="pb-5 text-neutral-400 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

const faqs = [
  {
    question: 'How do AI agents actually trade?',
    answer: 'Agents operate with funds you allocate to them. They analyze markets, identify opportunities based on your strategy, and execute trades automatically. You maintain full control — set limits, approve large trades, or pause anytime.',
  },
  {
    question: 'Is my capital safe?',
    answer: 'Agents can only trade with funds you explicitly allocate. They cannot withdraw or transfer funds outside of trading. All trades are logged transparently, and you can set maximum position sizes and daily limits.',
  },
  {
    question: 'Can I give agents custom instructions?',
    answer: 'Yes! Pro and Enterprise plans support natural language commands. Tell your agent "Focus on AI markets" or "Be more conservative when volatility is high" and it adapts its strategy accordingly.',
  },
  {
    question: 'What happens if an agent makes bad trades?',
    answer: 'You can set stop-losses and maximum drawdown limits. If an agent hits your risk threshold, it automatically pauses and alerts you. You can review its reasoning and adjust strategy before resuming.',
  },
  {
    question: 'Can I see what the agent is thinking?',
    answer: 'Absolutely. Every trade comes with the agent\'s reasoning — what data it analyzed, why it made the decision, and its confidence level. Full transparency is core to our design.',
  },
  {
    question: 'Do agents work 24/7?',
    answer: 'Yes. Unlike human traders, agents never sleep. They continuously monitor markets, news, and on-chain data to catch opportunities at any hour.',
  },
]

export default function HireAgents() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center">
            <p className="text-emerald-500 text-sm font-medium tracking-wide uppercase mb-4">Now Available</p>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Hire AI Agents<br />
              <span className="text-emerald-500">That Trade For You</span>
            </h1>
            
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
              24/7 market monitoring. Instant execution. Research on demand.
              Let AI handle the grunt work while you focus on strategy.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#pricing"
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                View Pricing
              </a>
              <Link
                to="/how-it-works"
                className="px-8 py-4 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium rounded-lg transition-colors text-lg"
              >
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            What Your Agents Can Do
          </h2>
          <p className="text-lg text-neutral-400 max-w-2xl mb-12">
            More than automated trading — your agents are research assistants, analysts, and execution partners.
          </p>
          
          <div className="space-y-0">
            {[
              { icon: '🔍', title: 'Continuous Research', description: 'Scan news, social media, and on-chain data 24/7. Surface relevant information before markets react.', metric: '100+ sources' },
              { icon: '📊', title: 'Market Analysis', description: 'Analyze probability movements, volume patterns, and trader behavior to identify opportunities.', metric: 'Real-time' },
              { icon: '⚡', title: 'Instant Execution', description: 'When conditions match your strategy, execute trades in milliseconds. No delays, no hesitation.', metric: '<100ms' },
              { icon: '🎯', title: 'Strategy Automation', description: "Define rules in plain English. 'Buy YES if probability drops below 30% on high confidence markets.'" },
              { icon: '📱', title: 'Smart Alerts', description: 'Get notified about market moves, trade executions, and opportunities that match your interests.' },
              { icon: '📝', title: 'Transparent Reasoning', description: 'Every decision explained. See exactly why your agent made each trade with full audit trails.' },
            ].map((cap, i) => (
              <div key={i} className="flex items-start gap-5 py-5 border-b border-neutral-800 last:border-0">
                <span className="text-2xl mt-0.5 shrink-0">{cap.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-lg font-semibold text-white">{cap.title}</h3>
                    {cap.metric && (
                      <span className="text-xs text-emerald-500 font-medium">{cap.metric}</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — comparison table style */}
      <section id="pricing" className="py-20 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-neutral-400 mb-12">
            Pay in sats. Cancel anytime. No hidden fees.
          </p>
          
          {/* Desktop: table layout */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-neutral-700">
                  {pricingTiers.map((tier) => (
                    <th key={tier.name} className="text-left pb-6 pr-8 last:pr-0 w-1/3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-white">{tier.name}</span>
                        {tier.highlighted && (
                          <span className="text-xs text-emerald-500 font-medium">★ Most Popular</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold text-white">{tier.price}</span>
                        <span className="text-neutral-500 text-sm">{tier.period}</span>
                      </div>
                      <p className="text-sm text-neutral-400 mt-1">{tier.description}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="align-top pr-8 last:pr-0 py-6">
                      <ul className="space-y-2.5 mb-8">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-emerald-500 mt-0.5">✓</span>
                            <span className="text-neutral-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                          tier.highlighted
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        }`}
                      >
                        {tier.cta}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked layout */}
          <div className="md:hidden space-y-0">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className={`py-8 border-b border-neutral-800 last:border-0 ${tier.highlighted ? 'bg-neutral-950' : ''}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold text-white">{tier.name}</span>
                  {tier.highlighted && (
                    <span className="text-xs text-emerald-500 font-medium">★ Most Popular</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-neutral-500 text-sm">{tier.period}</span>
                </div>
                <p className="text-sm text-neutral-400 mb-4">{tier.description}</p>
                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span className="text-neutral-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
          
          <p className="text-center text-sm text-neutral-500 mt-8">
            All plans include a 7-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* Social Proof — pull quotes, not cards */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">
            Trusted by Traders
          </h2>
          
          <div className="space-y-0">
            {[
              { quote: 'My agent caught a market mispricing at 3am that I would have completely missed. Paid for the whole year\'s subscription in one trade.', author: 'Alex K.', role: 'Pro Trader' },
              { quote: 'The research summaries alone are worth it. I get a daily briefing on all my markets with actual insights, not just price changes.', author: 'Sarah M.', role: 'Part-time Trader' },
              { quote: 'I was skeptical about letting AI trade for me, but the transparency is incredible. I can see exactly why every trade was made.', author: 'David R.', role: 'Hedge Fund Analyst' },
            ].map((t, i) => (
              <div key={i} className="py-6 border-b border-neutral-800 last:border-0">
                <p className="text-neutral-300 text-lg leading-relaxed mb-3">"{t.quote}"</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{t.author}</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-sm text-neutral-500">{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — flat list, no wrapper card */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">
            Frequently Asked Questions
          </h2>
          
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Trade Smarter?
          </h2>
          <p className="text-lg text-neutral-400 mb-8 max-w-2xl mx-auto">
            Start with a free trial. No credit card required. 
            Cancel anytime.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#pricing"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Get Started Free
            </a>
            <Link
              to="/enroll-agent"
              className="px-8 py-4 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium rounded-lg transition-colors"
            >
              I'm a Developer →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
