import { useState } from 'react'

type RoleCard = {
  title: string
  description: string
  points: string[]
}

type Capability = {
  label: string
  title: string
  description: string
}

type UseCase = {
  title: string
  description: string
}

const roleCards: RoleCard[] = [
  {
    title: 'You bring the edge',
    description: 'The thesis is yours. The agent is there to deepen it, not replace it.',
    points: [
      'Your perspective on what the market is missing',
      'The people, signals, and markets worth tracking',
      'Your time horizon, conviction, and risk limits',
      'The final say on how much capital should move',
    ],
  },
  {
    title: 'Hosted agents stress-test it',
    description:
      'Each hosted agent turns one line of thinking into a monitored, challengeable, rules-based process.',
    points: [
      'Monitor new evidence, market drift, and changing base rates continuously',
      'Validate and challenge the thesis with confirming and disconfirming information',
      'Map second-, third-, and fourth-order effects before they surprise you',
      'Trade within the permissions, sizing, and exit rules you define',
    ],
  },
]

const capabilities: Capability[] = [
  {
    label: '01',
    title: 'Keep the research surface live',
    description:
      'Watch the news, discussions, and adjacent markets tied to your thesis so your view keeps evolving after you log off.',
  },
  {
    label: '02',
    title: 'Reality-test the thesis',
    description:
      'A good agent should not just agree with you. It should surface counterarguments, broken assumptions, changing base rates, and signs the market is proving you wrong.',
  },
  {
    label: '03',
    title: 'Track higher-order effects',
    description:
      'Follow the second-, third-, and fourth-order consequences that often matter more than the first headline reaction.',
  },
  {
    label: '04',
    title: 'Turn conviction into rules',
    description:
      'Translate your view into concrete monitoring, entry, sizing, hedging, and exit instructions so capital deployment stays disciplined.',
  },
  {
    label: '05',
    title: 'Keep a live reasoning log',
    description:
      'See what changed, why the agent updated its view, and how your thinking has actually played out in the market over time.',
  },
  {
    label: '06',
    title: 'Trade inside guardrails',
    description:
      'Agents can express your view in the market, but only inside the guardrails you set and with a record you can inspect afterward.',
  },
]

const pricingInclusions = [
  'A dedicated mandate built around your thesis, watchlists, and rules',
  'Continuous monitoring, research briefs, and market alerts',
  'Scenario analysis across first- and higher-order effects',
  'Trade suggestions and execution inside your permissions and sizing rules',
  'A transparent log for review, adjustment, and postmortems',
]

const useCases: UseCase[] = [
  {
    title: 'Track one deep thesis',
    description:
      'Give one agent a concentrated view such as an energy bottleneck, AI timeline, or policy shift and let it keep that case updated against reality.',
  },
  {
    title: 'Run explicit counter-views',
    description:
      'Hire a second agent to argue the other side so your edge gets pressure-tested instead of turning into a private echo chamber.',
  },
  {
    title: 'Separate different edges',
    description:
      'Use different agents for macro, sector, or event-driven ideas so each one has a cleaner mandate and a clearer trading record.',
  },
]

const faqs = [
  {
    question: 'What am I paying for when I hire an agent?',
    answer:
      'You are hiring a hosted research and trading agent focused on the perspective, watchlists, and rules you define. The subscription covers ongoing monitoring, analysis, reasoning logs, and trading activity inside the permissions you grant.',
  },
  {
    question: 'Do hosted agents replace my judgment?',
    answer:
      'No. The edge still has to come from you. Hosted agents extend that edge by researching it, challenging it, monitoring it, and trading it inside the rules you define. They do not turn weak thinking into a free-money machine.',
  },
  {
    question: 'How many agents should I hire?',
    answer:
      'Start with one agent per distinct edge. If you have separate theses, time horizons, or deliberately opposing views you want tracked independently, hire additional agents instead of forcing one agent to cover everything.',
  },
  {
    question: 'What makes a strong hosted agent mandate?',
    answer:
      'A strong mandate has a clear question, a market universe, a time horizon, and explicit constraints. The more concrete your view is, the better the agent can research it, challenge it, and trade it coherently.',
  },
  {
    question: 'Will this guarantee better returns?',
    answer:
      'No. Hosted agents help you research more consistently, reason more clearly, and deploy capital more deliberately. Markets can still prove you wrong, and the value here is better process and tighter feedback loops, not effortless profits.',
  },
]

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="pr-4 font-medium text-white">{question}</span>
        <span className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && <div className="pb-5 text-sm leading-relaxed text-neutral-400">{answer}</div>}
    </div>
  )
}

export default function HireAgents() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-emerald-500">
              Hosted Agents
            </p>

            <h1 className="mb-6 text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
              Hire Hosted Agents
              <br />
              <span className="text-emerald-500">To Stress-Test Your Edge</span>
            </h1>

            <p className="mx-auto mb-6 max-w-3xl text-xl text-neutral-400">
              You bring the perspective, priors, and capital discipline. Hosted agents keep
              researching that view, validating and challenging it against new evidence,
              tracking how it plays out in reality, and trading within the rules you set.
            </p>

            <p className="mx-auto mb-8 max-w-2xl text-sm uppercase tracking-[0.2em] text-neutral-500">
              Starts at $150/month per hosted agent. Pay for the mandates you actually want
              running.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#pricing"
                className="rounded-lg bg-emerald-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                See Per-Agent Pricing
              </a>
              <a
                href="#how-it-works"
                className="rounded-lg border border-neutral-700 px-8 py-4 text-lg font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
              >
                How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
            Your edge stays human. The process stays live.
          </h2>
          <p className="mb-12 max-w-3xl text-lg text-neutral-400">
            This is not a promise of effortless profits from autonomous AI. The point is to
            keep your thinking live between market checks, reality-test it when evidence
            changes, and deploy capital with more structure than memory or vibes can support.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {roleCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"
              >
                <h3 className="mb-2 text-xl font-semibold text-white">{card.title}</h3>
                <p className="mb-5 text-sm leading-relaxed text-neutral-400">
                  {card.description}
                </p>
                <ul className="space-y-3">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-neutral-300">
                      <span className="mt-0.5 text-emerald-500">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Set the mandate',
                description:
                  'Start with a thesis, a market universe, and the evidence that should strengthen, weaken, or invalidate the view.',
              },
              {
                step: '02',
                title: 'Encode the rules',
                description:
                  'Decide whether the agent should only research, recommend trades, or trade inside explicit sizing, risk, and exit guardrails.',
              },
              {
                step: '03',
                title: 'Review reality',
                description:
                  'Use the agent log to see how your thinking evolved, which higher-order effects mattered, and where the thesis held up or broke.',
              },
            ].map((item) => (
              <div key={item.step} className="border-t border-neutral-800 pt-5">
                <p className="mb-2 text-sm font-medium text-emerald-500">{item.step}</p>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
            What each hosted agent is there to do
          </h2>
          <p className="mb-12 max-w-3xl text-lg text-neutral-400">
            Hosted agents are there to deepen and operationalize your edge, not to replace
            judgment with a magic box.
          </p>

          <div className="space-y-0">
            {capabilities.map((capability) => (
              <div
                key={capability.label}
                className="flex items-start gap-5 border-b border-neutral-800 py-6 last:border-0"
              >
                <span className="shrink-0 text-sm font-semibold tracking-[0.2em] text-emerald-500">
                  {capability.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white">{capability.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
            Per-agent pricing in dollars
          </h2>
          <p className="mb-12 max-w-3xl text-lg text-neutral-400">
            Pricing is simple: one monthly fee per hosted agent. Add agents only when you
            want another mandate, another time horizon, or an explicit counter-view.
          </p>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 md:p-10">
            <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-500">
                  Starts at
                </p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-5xl font-bold text-white md:text-6xl">$150</span>
                  <span className="pb-2 text-lg text-neutral-400">/month</span>
                </div>
                <p className="mt-3 text-lg text-white">per hosted agent</p>
                <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400">
                  No plan ladder. No forced bundles. If you want one agent focused on a
                  specific edge, you hire one. If you want a small desk of agents covering
                  multiple theses, time horizons, or competing interpretations, you hire the
                  number of agents that matches the work.
                </p>
              </div>

              <div>
                <h3 className="mb-5 text-lg font-semibold text-white">Each agent includes</h3>
                <ul className="space-y-3">
                  {pricingInclusions.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-neutral-300">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
            Ways to use hosted agents
          </h2>
          <p className="mb-12 max-w-3xl text-lg text-neutral-400">
            The right setup usually looks less like outsourcing your thinking and more like
            giving your best ideas a persistent operating system for research, monitoring,
            and rules-based capital deployment.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <h3 className="mb-3 text-xl font-semibold text-white">{useCase.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-3xl font-bold text-white md:text-4xl">
            Frequently Asked Questions
          </h2>

          {faqs.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      <section id="final-cta" className="border-t border-neutral-800 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Start with one hosted agent
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-neutral-400">
            Pick the sharpest view you have. Give it a mandate. Let an agent keep
            researching it, challenging it, and trading it with a cleaner record than
            memory alone.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#pricing"
              className="rounded-lg bg-emerald-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              See Per-Agent Pricing
            </a>
            <a
              href="#how-it-works"
              className="rounded-lg border border-neutral-700 px-8 py-4 font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Review How It Works
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
