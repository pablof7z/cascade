import { Link, useParams, useSearchParams } from 'react-router-dom'
import Discussion from './Discussion'
import { loadField } from './fieldStorage'
import type {
  AgentProvisioning,
  Field,
  FieldAttention,
  FieldDisagreement,
  FieldSource,
  FieldTopicStatus,
  MeetingActionStatus,
} from './fieldTypes'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const attentionClasses: Record<FieldAttention, string> = {
  steady: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'needs-input': 'border-sky-500/30 bg-sky-500/10 text-sky-300',
}

const disagreementClasses: Record<FieldDisagreement, string> = {
  contained: 'text-emerald-300',
  rising: 'text-amber-300',
  high: 'text-rose-300',
}

const topicStatusClasses: Record<FieldTopicStatus, string> = {
  active: 'text-emerald-300',
  watching: 'text-amber-300',
  'needs-judgment': 'text-sky-300',
}

const actionStatusClasses: Record<MeetingActionStatus, string> = {
  approved: 'text-emerald-300',
  queued: 'text-amber-300',
  'needs-human': 'text-sky-300',
}

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

type FieldDetailTab = 'markets' | 'discussions' | 'activity' | 'about'

const fieldDetailTabs = [
  { id: 'markets', label: 'Markets' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'activity', label: 'Activity' },
  { id: 'about', label: 'About' },
] satisfies Array<{ id: FieldDetailTab; label: string }>

function parseFieldDetailTab(value: string | null): FieldDetailTab {
  return fieldDetailTabs.find((tab) => tab.id === value)?.id ?? 'markets'
}

function formatUsd(value: number) {
  return currencyFormatter.format(value)
}

function getParticipantLabel(field: Field, participantId: string) {
  if (participantId === field.owner.id) return field.owner.name
  return field.council.find((agent) => agent.id === participantId)?.name ?? 'Unknown'
}

export default function FieldDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const field = id ? loadField(id) : undefined
  const activeTab = parseFieldDetailTab(searchParams.get('tab'))

  if (!field) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">Field not found</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">That field does not exist.</h1>
        <p className="mt-3 text-neutral-400">
          Return to the workspace home to open one of the seeded field mockups.
        </p>
        <Link
          to="/fields"
          className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
        >
          Back to Fields
        </Link>
      </div>
    )
  }

  const hostedCount = field.council.filter((agent) => agent.provisioning === 'hosted').length
  const latestEntries = field.meeting.entries.slice(-2).reverse()
  const tabCounts: Record<FieldDetailTab, number> = {
    markets: field.topics.length + field.positions.length + field.candidateMarkets.length,
    discussions: field.meeting.entries.length,
    activity: field.meeting.actions.length,
    about: field.sourceLibrary.length,
  }

  function handleTabChange(tab: FieldDetailTab) {
    const nextSearchParams = new URLSearchParams(searchParams)

    if (tab === 'markets') {
      nextSearchParams.delete('tab')
    } else {
      nextSearchParams.set('tab', tab)
    }

    setSearchParams(nextSearchParams)
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_42%)]">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-5 flex items-center gap-2 text-sm text-neutral-500">
            <Link to="/fields" className="transition-colors hover:text-white">
              Fields
            </Link>
            <span>/</span>
            <span className="text-neutral-300">{field.name}</span>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${attentionClasses[field.attention]}`}
                >
                  {field.attention.replace('-', ' ')}
                </span>
                <span
                  className={`text-xs font-medium uppercase tracking-[0.18em] ${disagreementClasses[field.disagreement]}`}
                >
                  Disagreement {field.disagreement}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
                {field.name}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-neutral-300">
                {field.summary}
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-500">
                {field.conviction}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={`/field/${field.id}/meeting`}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
              >
                Open Meeting
              </Link>
              <Link
                to="/hire-agents"
                className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Hire Hosted Agents
              </Link>
            </div>
          </div>

          <dl className="mt-10 grid border-y border-neutral-800 md:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800 xl:pl-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Active theses & questions
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{field.topics.length}</dd>
              <p className="mt-1 text-sm text-neutral-500">The field stays anchored in live judgments.</p>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Library sources
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">
                {field.sourceLibrary.length}
              </dd>
              <p className="mt-1 text-sm text-neutral-500">
                Sources are operating context, not attachments.
              </p>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:border-b-0 md:px-4 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Council members
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{field.council.length}</dd>
              <p className="mt-1 text-sm text-neutral-500">
                {hostedCount} hosted, {field.council.length - hostedCount} connected.
              </p>
            </div>
            <div className="px-0 py-4 md:px-4 md:pr-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Field wallet deployed
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">
                {formatUsd(field.capital.deployedUsd)}
              </dd>
              <p className="mt-1 text-sm text-neutral-500">
                Every action traces back to this field and its meeting record.
              </p>
            </div>
          </dl>

          <nav
            className="mt-10 flex gap-1 border-b border-neutral-800"
            role="tablist"
            aria-label="Field detail sections"
          >
            {fieldDetailTabs.map((tab) => {
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  id={`field-detail-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`field-detail-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? '-mb-px border-b-2 border-white text-white'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                  <span className="ml-2 text-[11px] text-neutral-600">{tabCounts[tab.id]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-10">
          <div
            id="field-detail-panel-markets"
            role="tabpanel"
            aria-labelledby="field-detail-tab-markets"
            tabIndex={activeTab === 'markets' ? 0 : -1}
            hidden={activeTab !== 'markets'}
            className="space-y-10"
          >
            <>
              <section className="border-t border-neutral-800 pt-6">
                <h2 className="text-2xl font-semibold text-white">Theses and questions</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  These are the live questions the council is working, not a generic list of
                  markets.
                </p>

                <div className="mt-6 border-t border-neutral-800">
                  {field.topics.map((topic) => (
                    <article
                      key={topic.id}
                      className="grid gap-3 border-b border-neutral-800 py-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-5"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
                        <span className="text-neutral-500">{topic.kind}</span>
                        <span className={`font-medium ${topicStatusClasses[topic.status]}`}>
                          {topic.status.replace('-', ' ')}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{topic.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {topic.summary}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="border-t border-neutral-800 pt-6">
                <h2 className="text-2xl font-semibold text-white">Current positions</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  These are the market expressions already carrying the field&apos;s conviction.
                </p>

                <div className="mt-6 border-t border-neutral-800">
                  {field.positions.map((position) => (
                    <article
                      key={position.id}
                      className="grid gap-2 border-b border-neutral-800 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-white">{position.label}</p>
                        <span className="text-sm text-neutral-300">
                          {formatUsd(position.exposureUsd)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                        {position.thesis}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="border-t border-neutral-800 pt-6">
                <h2 className="text-2xl font-semibold text-white">Candidate markets</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  New market proposals stay attached to the field instead of turning into a
                  detached catalog.
                </p>

                <div className="mt-6 border-t border-neutral-800">
                  {field.candidateMarkets.map((market) => (
                    <article
                      key={market.id}
                      className="grid gap-2 border-b border-neutral-800 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-white">{market.label}</p>
                        <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                          {market.status.replace('-', ' ')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                        {market.framing}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          </div>

          <div
            id="field-detail-panel-discussions"
            role="tabpanel"
            aria-labelledby="field-detail-tab-discussions"
            tabIndex={activeTab === 'discussions' ? 0 : -1}
            hidden={activeTab !== 'discussions'}
            className="space-y-10"
          >
            <Discussion scope="field" field={field} />
          </div>

          <div
            id="field-detail-panel-activity"
            role="tabpanel"
            aria-labelledby="field-detail-tab-activity"
            tabIndex={activeTab === 'activity' ? 0 : -1}
            hidden={activeTab !== 'activity'}
            className="space-y-10"
          >
            <section className="border-t border-neutral-800 pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Meeting room snapshot</h2>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    The field stays live through visible debate, cited evidence, and explicit
                    action proposals.
                  </p>
                </div>
                <Link
                  to={`/field/${field.id}/meeting`}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Open Full Meeting
                </Link>
              </div>

              <div className="mt-6 grid gap-3 border-y border-neutral-800 py-4 text-sm text-neutral-400 sm:grid-cols-3">
                <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                    Meeting
                  </p>
                  <p className="mt-2 font-medium text-white">{field.meeting.title}</p>
                </div>
                <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-4 sm:pb-0">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                    Summary
                  </p>
                  <p className="mt-2">{field.meeting.summary}</p>
                </div>
                <div className="sm:pl-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                    Updated
                  </p>
                  <p className="mt-2">{field.meeting.updatedAt}</p>
                </div>
              </div>

              <div className="border-t border-neutral-800">
                {latestEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="grid gap-3 border-b border-neutral-800 py-4 md:grid-cols-[minmax(0,1fr)_9rem]"
                  >
                    <div>
                      <p className="font-medium text-white">{entry.headline}</p>
                      <p className="mt-2 text-sm text-neutral-400">
                        {getParticipantLabel(field, entry.authorId)}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{entry.body}</p>
                    </div>
                    <div className="text-sm text-neutral-500 md:text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                        At
                      </p>
                      <p className="mt-2">{entry.at}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div
            id="field-detail-panel-about"
            role="tabpanel"
            aria-labelledby="field-detail-tab-about"
            tabIndex={activeTab === 'about' ? 0 : -1}
            hidden={activeTab !== 'about'}
            className="space-y-10"
          >
            <>
              <section className="border-t border-neutral-800 pt-6">
                <h2 className="text-2xl font-semibold text-white">Field framing</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {field.recentUpdate}
                </p>

                <div className="mt-6 grid gap-6 border-y border-neutral-800 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      Conviction
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                      {field.conviction}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      Live tensions
                    </p>
                    <div className="mt-3 space-y-3">
                      {field.meeting.tensions.map((tension) => (
                        <p key={tension} className="text-sm leading-relaxed text-neutral-400">
                          {tension}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-neutral-800 pt-6">
                <h2 className="text-2xl font-semibold text-white">Source library</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  The field library shapes how the council argues. Sources stay visible in the
                  room, and each one has a reason for being here.
                </p>

                <div className="mt-6 border-t border-neutral-800">
                  {field.sourceLibrary.map((source) => (
                    <article
                      key={source.id}
                      className="grid gap-3 border-b border-neutral-800 py-4 md:grid-cols-[minmax(0,1fr)_12rem]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                            {sourceKindLabels[source.kind]}
                          </p>
                          <p className="text-xs text-neutral-500">{source.author}</p>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-white">{source.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                          {source.note}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                          {source.relevance}
                        </p>
                      </div>
                      <div className="text-sm text-neutral-400 md:text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                          Added
                        </p>
                        <p className="mt-2">{source.addedAt}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          </div>
        </div>

        <div className="space-y-10">
          <section className="border-t border-neutral-800 pt-6">
            <h2 className="text-2xl font-semibold text-white">Council</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Hosted and connected agents work inside the same room. Hosted agents each keep a visible wallet.
            </p>

            <div className="mt-6 border-t border-neutral-800">
              {field.council.map((agent) => (
                <article
                  key={agent.id}
                  className="grid gap-4 border-b border-neutral-800 py-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${provisioningClasses[agent.provisioning]}`}
                        >
                          {agent.provisioning}
                        </span>
                        <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                          {agent.status}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-semibold text-white">{agent.name}</h3>
                      <p className="mt-1 text-sm text-neutral-400">{agent.role}</p>
                      <p className="mt-4 text-sm leading-relaxed text-neutral-300">{agent.focus}</p>
                      <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                        {agent.recentContribution}
                      </p>
                    </div>

                    <dl className="grid gap-3 border-t border-neutral-800 pt-4 text-sm sm:grid-cols-3 xl:min-w-[22rem] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                      <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-3">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Wallet balance
                        </dt>
                        <dd className="mt-2 font-semibold text-white">
                          {formatUsd(agent.wallet.balanceUsd)}
                        </dd>
                      </div>
                      <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-3 sm:pb-0">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Allocated
                        </dt>
                        <dd className="mt-2 font-semibold text-white">
                          {formatUsd(agent.wallet.allocatedUsd)}
                        </dd>
                      </div>
                      <div className="sm:pl-3">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Month to date
                        </dt>
                        <dd className="mt-2 font-semibold text-white">
                          {formatUsd(agent.wallet.monthlySpendUsd)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border-t border-neutral-800 pt-6">
            <h2 className="text-2xl font-semibold text-white">Capital context</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{field.capital.note}</p>

            <dl className="mt-6 grid border-y border-neutral-800 text-sm sm:grid-cols-2">
              <div className="border-b border-neutral-800 px-0 py-4 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-4">
                <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  Field wallet
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-white">
                  {formatUsd(field.capital.fieldWalletUsd)}
                </dd>
              </div>
              <div className="px-0 py-4 sm:pl-4">
                <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  Available
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-white">
                  {formatUsd(field.capital.availableUsd)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-t border-neutral-800 pt-6">
            <h2 className="text-2xl font-semibold text-white">Action queue</h2>
            <div className="mt-5 border-t border-neutral-800">
              {field.meeting.actions.map((action) => (
                <article
                  key={action.id}
                  className="grid gap-3 border-b border-neutral-800 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-white">{action.title}</p>
                    <span
                      className={`text-xs font-medium uppercase tracking-[0.18em] ${actionStatusClasses[action.status]}`}
                    >
                      {action.status.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    Owner: {getParticipantLabel(field, action.ownerId)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{action.rationale}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
