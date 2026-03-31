import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { AgentProvisioning, FieldSource } from './fieldTypes'

const usdPerHostedAgent = 150
const staffingBriefStorageKey = 'cascade-hiring-brief-v1'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

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

type StaffingPlannerState = {
  field: string
  mandate: string
  timeHorizon: string
  agentCount: number
  selectedRoles: string[]
  customRole: string
  deliverable: string
}

const timeHorizonOptions = [
  {
    id: '2-6 weeks',
    label: '2-6 weeks',
    description: 'Fast-moving field. Tight feedback loops and frequent updates.',
  },
  {
    id: '1-3 months',
    label: '1-3 months',
    description: 'Quarter-scale thesis work. Enough time for research and rebuttal.',
  },
  {
    id: '3-12 months',
    label: '3-12 months',
    description: 'Longer arc. Focus on catalyst calendars, regime shifts, and patience.',
  },
] as const

const staffingRoleOptions = [
  {
    id: 'lead-research',
    label: 'Lead researcher',
    description: 'Expands the thesis, source map, and key unknowns.',
  },
  {
    id: 'counterargument',
    label: 'Counterargument desk',
    description: 'Breaks the thesis before capital or reputation moves.',
  },
  {
    id: 'market-operator',
    label: 'Market operator',
    description: 'Turns discussion into concrete actions, thresholds, and follow-through.',
  },
  {
    id: 'source-librarian',
    label: 'Source librarian',
    description: 'Tracks filings, transcripts, notes, and refresh cycles.',
  },
  {
    id: 'catalyst-tracker',
    label: 'Catalyst tracker',
    description: 'Watches dates, launches, policy shifts, and event risk.',
  },
] as const

const defaultPlannerState: StaffingPlannerState = {
  field: '',
  mandate: '',
  timeHorizon: timeHorizonOptions[1].id,
  agentCount: 2,
  selectedRoles: ['lead-research', 'counterargument'],
  customRole: '',
  deliverable: '',
}

const staffingSteps = [
  {
    step: '01',
    title: 'Start with a field you actually understand',
    description:
      'Open a field around the beliefs, questions, and judgment you already have. Contrarian Markets is not for pointing agents at topics where you have no edge.',
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
      'They are two provisioning modes into the same workspace. Hosted agents are staffed and billed by Contrarian per agent in USD. Connected agents join the same field from your own existing runtime and still show up in the same council and meeting surfaces.',
  },
  {
    question: 'Does Contrarian sell passive profits or black-box trading?',
    answer:
      'No. The product is organized around fields where you already have conviction. Agents research, challenge, and operationalize that field, but the point is a better workspace and better judgment under pressure, not "trade for you" magic.',
  },
  {
    question: 'Why price per hosted agent instead of plan tiers?',
    answer:
      'Because staffing is the real choice. Add another hosted agent only when you need another role, another time horizon, or another counter-view inside a field. The workspace itself stays the same.',
  },
]

function formatUsd(value: number) {
  return currencyFormatter.format(value)
}

function clampAgentCount(value: number) {
  return Math.min(8, Math.max(1, value))
}

function getRoleLabels(selectedRoles: string[], customRole: string) {
  const mappedRoles = selectedRoles.reduce<string[]>((labels, roleId) => {
    const label = staffingRoleOptions.find((role) => role.id === roleId)?.label
    if (label) {
      labels.push(label)
    }

    return labels
  }, [])

  if (customRole.trim()) {
    mappedRoles.push(customRole.trim())
  }

  return mappedRoles
}

function getStoredPlannerState(): StaffingPlannerState {
  if (typeof window === 'undefined') {
    return defaultPlannerState
  }

  const storedValue = window.localStorage.getItem(staffingBriefStorageKey)
  if (!storedValue) {
    return defaultPlannerState
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<StaffingPlannerState>
    return {
      field: parsed.field ?? defaultPlannerState.field,
      mandate: parsed.mandate ?? defaultPlannerState.mandate,
      timeHorizon: parsed.timeHorizon ?? defaultPlannerState.timeHorizon,
      agentCount: clampAgentCount(parsed.agentCount ?? defaultPlannerState.agentCount),
      selectedRoles: Array.isArray(parsed.selectedRoles)
        ? parsed.selectedRoles.filter((value): value is string => typeof value === 'string')
        : defaultPlannerState.selectedRoles,
      customRole: parsed.customRole ?? defaultPlannerState.customRole,
      deliverable: parsed.deliverable ?? defaultPlannerState.deliverable,
    }
  } catch {
    return defaultPlannerState
  }
}

function buildHiringBrief(planner: StaffingPlannerState) {
  const roleLabels = getRoleLabels(planner.selectedRoles, planner.customRole)
  const lines = [
    `Field / topic: ${planner.field.trim() || 'Not set yet'}`,
    `Mandate / thesis: ${planner.mandate.trim() || 'Not set yet'}`,
    `Time horizon: ${planner.timeHorizon}`,
    `Hosted agent count: ${planner.agentCount}`,
    `Monthly cost: ${formatUsd(planner.agentCount * usdPerHostedAgent)}`,
    `Desired roles: ${roleLabels.length > 0 ? roleLabels.join(', ') : 'Count set, roles still open'}`,
  ]

  if (planner.deliverable.trim()) {
    lines.push(`Month-one deliverable: ${planner.deliverable.trim()}`)
  }

  lines.push(
    'Truthfulness constraint: human brings the thesis and edge; hosted agents extend it inside one visible workspace.',
  )

  return lines.join('\n')
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="pr-4 font-medium text-white">{question}</span>
        <span
          aria-hidden="true"
          className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          v
        </span>
      </button>
      {isOpen ? (
        <div id={panelId} className="pb-5 text-sm leading-relaxed text-neutral-400">
          {answer}
        </div>
      ) : null}
    </div>
  )
}

export default function HireAgents() {
  const navigate = useNavigate()
  const workspace = loadFieldWorkspace()
  const showcaseField = workspace.fields[0]
  const hostedAgents = showcaseField?.council.filter((agent) => agent.provisioning === 'hosted') ?? []
  const connectedAgents =
    showcaseField?.council.filter((agent) => agent.provisioning === 'connected') ?? []
  const [planner, setPlanner] = useState<StaffingPlannerState>(getStoredPlannerState)
  const [briefStatus, setBriefStatus] = useState<string | null>(null)

  const selectedRoleLabels = getRoleLabels(planner.selectedRoles, planner.customRole)
  const monthlyCost = planner.agentCount * usdPerHostedAgent
  const briefReady = planner.field.trim().length > 0 && planner.mandate.trim().length > 0
  const roleCompression = selectedRoleLabels.length > planner.agentCount
  const hiringBrief = buildHiringBrief(planner)

  function patchPlanner(patch: Partial<StaffingPlannerState>) {
    setPlanner((current) => ({ ...current, ...patch }))
    setBriefStatus(null)
  }

  function toggleRole(roleId: string) {
    setPlanner((current) => {
      const nextRoles = current.selectedRoles.includes(roleId)
        ? current.selectedRoles.filter((value) => value !== roleId)
        : [...current.selectedRoles, roleId]

      return { ...current, selectedRoles: nextRoles }
    })
    setBriefStatus(null)
  }

  function saveBrief() {
    try {
      window.localStorage.setItem(staffingBriefStorageKey, JSON.stringify(planner))
      setBriefStatus(
        'Brief saved on this device. Next step: review the workspace this staff would use.',
      )
      return true
    } catch {
      setBriefStatus('Storage is unavailable in this browser. Copy the brief instead.')
      return false
    }
  }

  async function copyBrief() {
    if (!navigator.clipboard?.writeText) {
      setBriefStatus('Clipboard access is unavailable in this browser.')
      return
    }

    try {
      await navigator.clipboard.writeText(hiringBrief)
      setBriefStatus('Brief copied. Use it as the handoff into a workspace or agent install flow.')
    } catch {
      setBriefStatus('Copy failed. Your brief is still visible below.')
    }
  }

  function saveAndReviewWorkspace() {
    if (saveBrief()) {
      navigate(showcaseField ? `/field/${showcaseField.id}` : '/dashboard/fields')
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_46%)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
              Hosted Agents
            </p>
            <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl">
              Write the mandate first. Then staff hosted agents around it.
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-neutral-300">
              Describe the field, the thesis, the time horizon, and the roles you need.
              Contrarian turns that brief into one visible workspace where hosted agents
              research, challenge, and operationalize your edge instead of pretending to
              replace it.
            </p>
            <p className="mt-6 text-sm uppercase tracking-[0.2em] text-neutral-500">
              Hosted agents start at ${usdPerHostedAgent}/month each. Pricing is per hosted
              agent in USD, not by plan tier.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#planner"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              Build Hiring Brief
            </a>
            {showcaseField ? (
              <Link
                to={`/dashboard/field/${showcaseField.id}/meeting`}
                className="rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Open Example Meeting
              </Link>
            ) : null}
            <a
              href="#pricing"
              className="rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              See Per-Agent Pricing
            </a>
          </div>
        </div>
      </section>

      <section id="planner" className="border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
                  Staffing planner
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                  Build the brief before you try to hire.
                </h2>
                <p className="mt-3 text-lg leading-relaxed text-neutral-400">
                  This is the minimal credible path on the page today. No fake checkout.
                  No plan ladder. Just the field, the mandate, the roles, and the monthly
                  cost of staffing them.
                </p>
              </div>

              <div className="mt-10 border-y border-neutral-800">
                <div className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Field / topic
                    </p>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={planner.field}
                      onChange={(event) => patchPlanner({ field: event.target.value })}
                      placeholder="AI chip supply chain through 2027"
                      className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-500"
                    />
                    <p className="mt-2 text-sm text-neutral-500">
                      Start with a field where the human operator already has conviction or
                      domain context.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Mandate / thesis
                    </p>
                  </div>
                  <div>
                    <textarea
                      value={planner.mandate}
                      onChange={(event) => patchPlanner({ mandate: event.target.value })}
                      rows={5}
                      placeholder="Track whether export controls tighten supply faster than demand resets, and surface the facts that would break that view."
                      className="w-full resize-none border border-neutral-800 bg-neutral-950 px-4 py-3 text-base leading-relaxed text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-500"
                    />
                    <p className="mt-2 text-sm text-neutral-500">
                      Say what the agents are supposed to test, not vague outcomes you wish
                      would happen.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Time horizon
                    </p>
                  </div>
                  <div className="border-t border-neutral-800">
                    {timeHorizonOptions.map((option) => {
                      const isSelected = planner.timeHorizon === option.id

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => patchPlanner({ timeHorizon: option.id })}
                          className={`grid w-full gap-1 border-b border-neutral-800 py-4 text-left transition-colors ${
                            isSelected ? 'text-white' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                            {option.label}
                          </span>
                          <span className="text-sm leading-relaxed text-neutral-500">
                            {option.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Hosted roles
                    </p>
                  </div>
                  <div>
                    <div className="border-t border-neutral-800">
                      {staffingRoleOptions.map((role) => {
                        const isSelected = planner.selectedRoles.includes(role.id)

                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => toggleRole(role.id)}
                            className="grid w-full gap-2 border-b border-neutral-800 py-4 text-left"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span
                                className={`text-sm font-semibold uppercase tracking-[0.18em] ${
                                  isSelected ? 'text-white' : 'text-neutral-400'
                                }`}
                              >
                                {role.label}
                              </span>
                              <span
                                className={`text-xs uppercase tracking-[0.18em] ${
                                  isSelected ? 'text-emerald-400' : 'text-neutral-600'
                                }`}
                              >
                                {isSelected ? 'Included' : 'Optional'}
                              </span>
                            </div>
                            <span className="text-sm leading-relaxed text-neutral-500">
                              {role.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <input
                      type="text"
                      value={planner.customRole}
                      onChange={(event) => patchPlanner({ customRole: event.target.value })}
                      placeholder="Add another role if this field needs one"
                      className="mt-4 w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-500"
                    />

                    {roleCompression ? (
                      <p className="mt-3 text-sm leading-relaxed text-amber-300">
                        You selected more roles than hosted agents. That can work, but the
                        brief is asking each agent to cover multiple jobs.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Hosted agents
                    </p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="inline-flex items-center border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => patchPlanner({ agentCount: clampAgentCount(planner.agentCount - 1) })}
                          className="px-4 py-3 text-lg text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
                          aria-label="Decrease hosted agent count"
                        >
                          -
                        </button>
                        <div className="border-x border-neutral-800 px-6 py-3 text-2xl font-semibold text-white">
                          {planner.agentCount}
                        </div>
                        <button
                          type="button"
                          onClick={() => patchPlanner({ agentCount: clampAgentCount(planner.agentCount + 1) })}
                          className="px-4 py-3 text-lg text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
                          aria-label="Increase hosted agent count"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm leading-relaxed text-neutral-400">
                        Linear cost: {planner.agentCount} x {formatUsd(usdPerHostedAgent)} =
                        {' '}
                        <span className="font-semibold text-white">{formatUsd(monthlyCost)}/month</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Month-one output
                    </p>
                  </div>
                  <div>
                    <textarea
                      value={planner.deliverable}
                      onChange={(event) => patchPlanner({ deliverable: event.target.value })}
                      rows={3}
                      placeholder="Weekly thesis updates, a source map, a catalyst calendar, and rebuttal notes."
                      className="w-full resize-none border border-neutral-800 bg-neutral-950 px-4 py-3 text-base leading-relaxed text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-500"
                    />
                    <p className="mt-2 text-sm text-neutral-500">
                      Optional, but useful. Ask for a concrete output instead of general
                      "help."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="lg:border-l lg:border-neutral-800 lg:pl-8">
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                Hiring brief
              </p>
              <div className="mt-4 border-y border-neutral-800 py-6">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold text-white">{formatUsd(monthlyCost)}</span>
                  <span className="pb-1 text-lg text-neutral-400">/month</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {planner.agentCount} hosted agent{planner.agentCount === 1 ? '' : 's'} at
                  {' '}
                  {formatUsd(usdPerHostedAgent)}
                  {' '}
                  each. No bundles. No package math. Add headcount only when the field needs
                  another role or another counter-view.
                </p>
              </div>

              <div className="mt-6 border-b border-neutral-800 pb-6">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="uppercase tracking-[0.18em] text-neutral-500">Field</p>
                    <p className="mt-2 text-white">
                      {planner.field.trim() || 'Set the field you actually understand.'}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em] text-neutral-500">Horizon</p>
                    <p className="mt-2 text-white">{planner.timeHorizon}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em] text-neutral-500">Roles</p>
                    <p className="mt-2 text-white">
                      {selectedRoleLabels.length > 0 ? selectedRoleLabels.join(', ') : 'Still open'}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em] text-neutral-500">
                      Month-one output
                    </p>
                    <p className="mt-2 text-white">
                      {planner.deliverable.trim() || 'Still open'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">
                  Brief preview
                </p>
                <pre className="mt-4 whitespace-pre-wrap border-y border-neutral-800 py-5 font-mono text-[13px] leading-relaxed text-neutral-300">
                  {hiringBrief}
                </pre>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveAndReviewWorkspace}
                  disabled={!briefReady}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  Save and Review Workspace
                </button>
                <button
                  type="button"
                  onClick={copyBrief}
                  disabled={!briefReady}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
                >
                  Copy Brief
                </button>
                <Link
                  to="/enroll-agent"
                  onClick={saveBrief}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Connect Existing Agent
                </Link>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                No hosted-agent checkout is live on this page yet. The brief is the handoff
                artifact. Save it locally, review the example workspace, or move into the
                install flow if you already run your own agent.
              </p>

              {briefStatus ? (
                <p className="mt-4 text-sm leading-relaxed text-emerald-300">{briefStatus}</p>
              ) : null}

              {!briefReady ? (
                <p className="mt-4 text-sm leading-relaxed text-amber-300">
                  Add the field and mandate first. The brief should say what the desk is
                  supposed to test.
                </p>
              ) : null}
            </aside>
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

          <div className="mt-10 border-t border-neutral-800">
            {staffingSteps.map((item) => (
              <article
                key={item.step}
                className="grid gap-3 border-b border-neutral-800 py-5 md:grid-cols-[4rem_minmax(0,1fr)] md:gap-5"
              >
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
                  {item.step}
                </p>
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {item.description}
                  </p>
                </div>
              </article>
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

          <div className="mt-10 grid gap-6 border-t border-neutral-800 pt-6 md:grid-cols-3">
            {workspaceCards.map((card) => (
              <article
                key={card.eyebrow}
                className="border-b border-neutral-800 pb-5 md:border-b-0 md:border-r md:border-neutral-800 md:pr-5 last:border-r-0"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">{card.eyebrow}</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {showcaseField ? (
        <section className="border-b border-neutral-800">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Hosted and connected agents share one workspace.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-neutral-400">
                Once the agents are inside, there is no separate product story. Hosted and
                connected agents sit in the same council, use the same field library, join
                the same meetings, and stay tied to the same human judgment.
              </p>

              <div className="mt-8 border-t border-neutral-800 pt-6">
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                  Example field
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">{showcaseField.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {showcaseField.summary}
                </p>

                <dl className="mt-6 grid border-y border-neutral-800 text-sm sm:grid-cols-3">
                  <div className="border-b border-neutral-800 px-0 py-4 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-4">
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      Theses
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.topics.length}
                    </dd>
                  </div>
                  <div className="border-b border-neutral-800 px-0 py-4 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-4">
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      Sources
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.sourceLibrary.length}
                    </dd>
                  </div>
                  <div className="px-0 py-4 sm:pl-4">
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      Meeting actions
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-white">
                      {showcaseField.meeting.actions.length}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={`/dashboard/field/${showcaseField.id}`}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                  >
                    Open Field
                  </Link>
                  <Link
                    to={`/dashboard/field/${showcaseField.id}/meeting`}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Open Meeting
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Library snapshot</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Shared sources driving the council
                  </h3>
                </div>
                <p className="text-sm text-neutral-500">{showcaseField.meeting.updatedAt}</p>
              </div>

              <div className="mt-6 border-t border-neutral-800">
                {showcaseField.sourceLibrary.slice(0, 3).map((source) => (
                  <article
                    key={source.id}
                    className="grid gap-2 border-b border-neutral-800 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-white">{source.title}</p>
                      <span className="text-xs text-neutral-500">
                        {sourceKindLabels[source.kind]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{source.note}</p>
                  </article>
                ))}
              </div>

              <div className="mt-8">
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Council and wallets</p>
                <div className="mt-4 border-t border-neutral-800">
                  {showcaseField.council.map((agent) => (
                    <article
                      key={agent.id}
                      className="grid gap-4 border-b border-neutral-800 py-4"
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
                      <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-3">
                          <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Balance</dt>
                          <dd className="mt-2 font-semibold text-white">
                            {formatUsd(agent.wallet.balanceUsd)}
                          </dd>
                        </div>
                        <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-3">
                          <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                            Allocated
                          </dt>
                          <dd className="mt-2 font-semibold text-white">
                            {formatUsd(agent.wallet.allocatedUsd)}
                          </dd>
                        </div>
                        <div className="sm:pl-3">
                          <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                            Month to date
                          </dt>
                          <dd className="mt-2 font-semibold text-white">
                            {formatUsd(agent.wallet.monthlySpendUsd)}
                          </dd>
                        </div>
                      </dl>
                    </article>
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

          <div className="mt-10 grid gap-8 border-t border-neutral-800 pt-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Current brief</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-6xl font-bold text-white">{formatUsd(monthlyCost)}</span>
                  <span className="pb-2 text-lg text-neutral-400">/month</span>
                </div>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
                  {planner.agentCount} hosted agent{planner.agentCount === 1 ? '' : 's'} x
                  {' '}
                  {formatUsd(usdPerHostedAgent)}
                  {' '}
                  per month. One price per hosted agent, billed in USD, with no bundles hiding
                  the staffing choice.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#planner"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                  >
                    Edit Brief
                  </a>
                  <Link
                    to="/enroll-agent"
                    onClick={saveBrief}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Connect Existing Agent
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">Each hosted agent includes</h3>
                <div className="mt-5 border-t border-neutral-800">
                  {pricingInclusions.map((item) => (
                    <div
                      key={item}
                      className="border-b border-neutral-800 py-3 text-sm leading-relaxed text-neutral-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-neutral-500">
                  Connected agents are not a different product. They join the same field workspace when
                  you already run your own stack and want to bring that agent into Contrarian's shared
                  sources, meetings, and wallet-aware field view.
                </p>
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
            Finish the brief, then step into the workspace.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-neutral-400">
            The credible path here is simple: define the field, price the headcount, save the
            brief, and review the workspace that staff would actually use.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#planner"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              Build Hiring Brief
            </a>
            <Link
              to="/enroll-agent"
              onClick={saveBrief}
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
