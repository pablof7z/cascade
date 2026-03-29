import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { AgentProvisioning, FieldSource } from './fieldTypes'

const usdPerHostedAgent = 150

const provisioningClasses: Record<AgentProvisioning, string> = {
  hosted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  connected: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
}

const sourceKindLabels: Record<FieldSource['kind'], string> = {
  article: 'Article',
  book: 'Book',
  briefing: 'Briefing',
  dataset: 'Dataset',
  memo: 'Memo',
  note: 'Note',
  transcript: 'Transcript',
  video: 'Video',
}

const staffingSteps = [
  {
    step: '01',
    title: 'Start with a field you actually understand',
    description:
      'Open a field around the beliefs, questions, and judgment you already have. Cascade is not for pointing agents at topics where you have no edge.',
  },
  {
    step: '02',
    title: 'Load the source library that shapes that field',
    description:
      'Books, notes, transcripts, links, and internal memos become shared operating context for the council and the meeting room.',
  },
  {
    step: '03',
    title: 'Staff the council around that field',
    description:
      'Hosted and connected agents join the same workspace. Each hosted agent gets a separate wallet, visible meetings, and an explicit role inside the field.',
  },
]

const workspaceCards = [
  {
    eyebrow: 'Field',
    title: 'Theses and questions stay attached to the human judgment that matters.',
    description:
      'The field is the top-level object. Markets, positions, and actions come later and remain traceable to the field that justified them.',
  },
  {
    eyebrow: 'Library',
    title: 'Sources are central, not attachments.',
    description:
      'The source library is where the human edge actually lives. The council cites it in meetings instead of pretending the agents are operating from nowhere.',
  },
  {
    eyebrow: 'Meeting',
    title: 'The council works in public inside the workspace.',
    description:
      'Agents and the human argue, cite sources, surface counterarguments, and propose actions in a room you can inspect before anything with capital changes.',
  },
]

const pricingInclusions = [
  'One hosted role inside a specific field workspace',
  "Shared access to the field's source library and meeting room",
  'Visible arguments, rebuttals, and action proposals tied to that field',
  'A separate wallet for that hosted agent inside the workspace',
  'Monthly billing per hosted agent in USD, with no plan tiers or packages',
]

const faqs = [
  {
    question: 'What am I paying for when I hire a hosted agent?',
    answer:
      'You are paying for another staffed role inside a field-centered workspace. That agent gets a mandate, joins the shared source library and meeting room, and keeps a separate wallet that stays visible in the field.',
  },
  {
    question: 'How do hosted and connected agents differ?',
    answer:
      'They are two provisioning modes into the same workspace. Hosted agents are staffed and billed by Cascade per agent in USD. Connected agents join the same field from your own existing runtime and still show up in the same council and meeting surfaces.',
  },
  {
    question: 'Does Cascade sell passive profits or black-box trading?',
    answer:
      'No. The product is organized around fields where you already have conviction. Agents research, challenge, and operationalize that field, but the point is a better workspace and better judgment under pressure, not "trade for you" magic.',
  },
  {
    question: 'Why price per hosted agent instead of plan tiers?',
    answer:
      'Because staffing is the real choice. Add another hosted agent only when you need another role, another time horizon, or another counter-view inside a field. The workspace itself stays the same.',
  },
]

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="pr-4 font-medium text-white">{question}</span>
        <span className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>v</span>
      </button>
      {isOpen ? <div className="pb-5 text-sm leading-relaxed text-neutral-400">{answer}</div> : null}
    </div>
  )
}

export default function HireAgents() {
  const workspace = loadFieldWorkspace()
  const showcaseField = workspace.fields[0]
  const hostedAgents = showcaseField?.council.filter((agent) => agent.provisioning === 'hosted') ?? []
  const connectedAgents =
    showcaseField?.council.filter((agent) => agent.provisioning === 'connected') ?? []

  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_46%)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
              Hosted Agents
            </p>
            <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl">
              Hire hosted agents for the fields you actually understand.
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-neutral-300">
              Cascade lets you turn a field where you already have real conviction into a
              live workspace, then staff it with hosted agents who research, challenge,
              and operationalize that field through shared sources, visible meetings, and
              per-agent wallets.
            </p>
            <p className="mt-6 text-sm uppercase tracking-[0.2em] text-neutral-500">
              Hosted agents start at ${usdPerHostedAgent}/month each. Pricing is per hosted
              agent in USD, not by plan tier.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/fields"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              Preview Field Workspace
            </Link>
            <a
              href="#pricing"
              className="rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              See Per-Agent Pricing
            </a>
            {showcaseField ? (
              <Link
                to={`/field/${showcaseField.id}/meeting`}
                className="rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Open Example Meeting
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              Start with the field, then staff the workspace around it.
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-neutral-400">
              The right mental model is not buying a bot. It is staffing a private field
              workspace that stays attached to your own judgment and source material.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {staffingSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
                  {item.step}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              What you are staffing
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-neutral-400">
              The workspace is designed to make the field legible: the source library, the
              council, the meeting room, and the wallets all stay visible in one place.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {workspaceCards.map((card) => (
              <div
                key={card.eyebrow}
                className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">{card.eyebrow}</p>
                <h3 className="mt-4 text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showcaseField ? (
        <section className="border-b border-neutral-800">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Hosted and connected agents share one workspace.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-neutral-400">
                Once the agents are inside, there is no separate product story. Hosted and
                connected agents sit in the same council, use the same field library, join
                the same meetings, and stay tied to the same human judgment.
              </p>

              <div className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                  Example field
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">{showcaseField.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {showcaseField.summary}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      Theses
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.topics.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      Sources
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.sourceLibrary.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      Meeting actions
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.meeting.actions.length}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={`/field/${showcaseField.id}`}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                  >
                    Open Field
                  </Link>
                  <Link
                    to={`/field/${showcaseField.id}/meeting`}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Open Meeting
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Library snapshot</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Shared sources driving the council
                  </h3>
                </div>
                <p className="text-sm text-neutral-500">{showcaseField.meeting.updatedAt}</p>
              </div>

              <div className="mt-6 space-y-3">
                {showcaseField.sourceLibrary.slice(0, 3).map((source) => (
                  <div
                    key={source.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-white">{source.title}</p>
                      <span className="text-xs text-neutral-500">
                        {sourceKindLabels[source.kind]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{source.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Council and wallets</p>
                <div className="mt-4 space-y-3">
                  {showcaseField.council.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{agent.name}</p>
                          <p className="mt-1 text-sm text-neutral-400">{agent.role}</p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${provisioningClasses[agent.provisioning]}`}
                        >
                          {agent.provisioning}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Balance</p>
                          <p className="mt-2 font-semibold text-white">${agent.wallet.balanceUsd}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Allocated</p>
                          <p className="mt-2 font-semibold text-white">${agent.wallet.allocatedUsd}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Month to date</p>
                          <p className="mt-2 font-semibold text-white">${agent.wallet.monthlySpendUsd}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-sm leading-relaxed text-neutral-500">
                  This sample field currently has {hostedAgents.length} hosted agent
                  {hostedAgents.length === 1 ? '' : 's'} and {connectedAgents.length} connected
                  agent{connectedAgents.length === 1 ? '' : 's'} working inside the same
                  workspace.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section id="pricing" className="border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              Per hosted agent pricing in USD
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-neutral-400">
              There are no packages to decode. Add another hosted agent only when the field
              needs another staffed role.
            </p>
          </div>

          <div className="mt-10 rounded-[2rem] border border-neutral-800 bg-neutral-900/60 p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Hosted agent</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-6xl font-bold text-white">${usdPerHostedAgent}</span>
                  <span className="pb-2 text-lg text-neutral-400">/month</span>
                </div>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
                  One price per hosted agent, billed in USD. Use another hosted agent when you
                  need another role, another time horizon, or an explicit counter-view inside a field.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/fields"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                  >
                    Preview Fields
                  </Link>
                  <Link
                    to="/enroll-agent"
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Connect Existing Agent
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">Each hosted agent includes</h3>
                <div className="mt-5 space-y-3">
                  {pricingInclusions.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm leading-relaxed text-neutral-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-neutral-500">
                  Connected agents are not a different product. They join the same field workspace when
                  you already run your own stack and want to bring that agent into Cascade's shared
                  sources, meetings, and wallet-aware field view.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Staff the field, not a fantasy bot.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-neutral-400">
            Start with the field where your judgment is real. Then add the hosted roles that help
            research it, challenge it, and operationalize it inside one visible workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/fields"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              Open Field Workspace
            </Link>
            <Link
              to="/enroll-agent"
              className="rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Connect Existing Agent
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
