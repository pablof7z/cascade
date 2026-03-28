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
  badge?: string
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
    badge: 'Most Popular',
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

// Agent capability visualization
function AgentCapability({ 
  icon, 
  title, 
  description,
  metric 
}: { 
  icon: string
  title: string
  description: string
  metric?: string
}) {
  return (
    <div className="group p-6 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center text-2xl">
          {icon}
        </div>
        {metric && (
          <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
            {metric}
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
    </div>
  )
}

// Testimonial card
function TestimonialCard({ 
  quote, 
  author, 
  role, 
  avatar 
}: { 
  quote: string
  author: string
  role: string
  avatar: string
}) {
  return (
    <div className="p-6 rounded-xl bg-neutral-900/30 border border-neutral-800">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-amber-500">★</span>
        ))}
      </div>
      <p className="text-neutral-300 mb-4 leading-relaxed">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-semibold">
          {avatar}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{author}</div>
          <div className="text-xs text-neutral-500">{role}</div>
        </div>
      </div>
    </div>
  )
}

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
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="max-w-5xl mx-auto px-6 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Now Available
            </div>
            
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
      <section className="py-20 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What Your Agents Can Do
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              More than automated trading — your agents are research assistants, analysts, and execution partners.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AgentCapability
              icon="🔍"
              title="Continuous Research"
              description="Scan news, social media, and on-chain data 24/7. Surface relevant information before markets react."
              metric="100+ sources"
            />
            <AgentCapability
              icon="📊"
              title="Market Analysis"
              description="Analyze probability movements, volume patterns, and trader behavior to identify opportunities."
              metric="Real-time"
            />
            <AgentCapability
              icon="⚡"
              title="Instant Execution"
              description="When conditions match your strategy, execute trades in milliseconds. No delays, no hesitation."
              metric="<100ms"
            />
            <AgentCapability
              icon="🎯"
              title="Strategy Automation"
              description="Define rules in plain English. 'Buy YES if probability drops below 30% on high confidence markets.'"
            />
            <AgentCapability
              icon="📱"
              title="Smart Alerts"
              description="Get notified about market moves, trade executions, and opportunities that match your interests."
            />
            <AgentCapability
              icon="📝"
              title="Transparent Reasoning"
              description="Every decision explained. See exactly why your agent made each trade with full audit trails."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-neutral-400">
              Pay in sats. Cancel anytime. No hidden fees.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 ${
                  tier.highlighted
                    ? 'bg-gradient-to-b from-emerald-500/10 to-neutral-900 border-2 border-emerald-500/50'
                    : 'bg-neutral-900/50 border border-neutral-800'
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full">
                      {tier.badge}
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                    <span className="text-neutral-500 text-sm">{tier.period}</span>
                  </div>
                  <p className="text-sm text-neutral-400 mt-2">{tier.description}</p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
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

      {/* Social Proof */}
      <section className="py-20 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Traders
            </h2>
            <p className="text-lg text-neutral-400">
              Join the growing community of traders using AI agents.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              quote="My agent caught a market mispricing at 3am that I would have completely missed. Paid for the whole year's subscription in one trade."
              author="Alex K."
              role="Pro Trader"
              avatar="AK"
            />
            <TestimonialCard
              quote="The research summaries alone are worth it. I get a daily briefing on all my markets with actual insights, not just price changes."
              author="Sarah M."
              role="Part-time Trader"
              avatar="SM"
            />
            <TestimonialCard
              quote="I was skeptical about letting AI trade for me, but the transparency is incredible. I can see exactly why every trade was made."
              author="David R."
              role="Hedge Fund Analyst"
              avatar="DR"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-neutral-900">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          
          <div className="bg-neutral-900/30 rounded-2xl border border-neutral-800 p-6 md:p-8">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-neutral-900">
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
