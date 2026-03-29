import { Link, useParams } from 'react-router-dom'
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

function formatUsd(value: number) {
  return currencyFormatter.format(value)
}

function getParticipantLabel(field: Field, participantId: string) {
  if (participantId === field.owner.id) return field.owner.name
  return field.council.find((agent) => agent.id === participantId)?.name ?? 'Unknown'
}

export default function FieldDetail() {
  const { id } = useParams<{ id: string }>()
  const field = id ? loadField(id) : undefined

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

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Active theses & questions</p>
              <p className="mt-2 text-3xl font-semibold text-white">{field.topics.length}</p>
              <p className="mt-2 text-sm text-neutral-500">The field stays anchored in live judgments.</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Library sources</p>
              <p className="mt-2 text-3xl font-semibold text-white">{field.sourceLibrary.length}</p>
              <p className="mt-2 text-sm text-neutral-500">Sources are operating context, not attachments.</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Council members</p>
              <p className="mt-2 text-3xl font-semibold text-white">{field.council.length}</p>
              <p className="mt-2 text-sm text-neutral-500">
                {hostedCount} hosted, {field.council.length - hostedCount} connected.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Field wallet deployed</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatUsd(field.capital.deployedUsd)}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Every action traces back to this field and its meeting record.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-8">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Theses and questions</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              These are the live questions the council is working, not a generic list of markets.
            </p>

            <div className="mt-6 grid gap-4">
              {field.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      {topic.kind}
                    </span>
                    <span
                      className={`text-xs font-medium uppercase tracking-[0.18em] ${topicStatusClasses[topic.status]}`}
                    >
                      {topic.status.replace('-', ' ')}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{topic.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{topic.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Source library</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              The field library shapes how the council argues. Sources stay visible in the room,
              and each one has a reason for being here.
            </p>

            <div className="mt-6 space-y-4">
              {field.sourceLibrary.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        {sourceKindLabels[source.kind]}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{source.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">{source.author}</p>
                    </div>
                    <p className="text-xs text-neutral-500">{source.addedAt}</p>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-neutral-300">{source.note}</p>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-500">{source.relevance}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Meeting room snapshot</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  The field stays live through visible debate, cited evidence, and explicit action proposals.
                </p>
              </div>
              <Link
                to={`/field/${field.id}/meeting`}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Open Full Meeting
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                {field.meeting.title}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{field.meeting.summary}</p>
              <p className="mt-2 text-sm text-neutral-500">Updated {field.meeting.updatedAt}</p>
            </div>

            <div className="mt-5 space-y-3">
              {latestEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-white">{entry.headline}</p>
                    <span className="text-xs text-neutral-500">{entry.at}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    {getParticipantLabel(field, entry.authorId)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">{entry.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Council</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Hosted and connected agents work inside the same room. Hosted agents each keep a visible wallet.
            </p>

            <div className="mt-6 space-y-4">
              {field.council.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5"
                >
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

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Wallet balance</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatUsd(agent.wallet.balanceUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Allocated</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatUsd(agent.wallet.allocatedUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Month to date</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatUsd(agent.wallet.monthlySpendUsd)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Capital context</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{field.capital.note}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Field wallet</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatUsd(field.capital.fieldWalletUsd)}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Available</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatUsd(field.capital.availableUsd)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Current positions</h3>
                <div className="mt-3 space-y-3">
                  {field.positions.map((position) => (
                    <div
                      key={position.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
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
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">Candidate markets</h3>
                <div className="mt-3 space-y-3">
                  {field.candidateMarkets.map((market) => (
                    <div
                      key={market.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Action queue</h2>
            <div className="mt-5 space-y-3">
              {field.meeting.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
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
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
