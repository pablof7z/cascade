import { Link, useParams } from 'react-router-dom'
import { loadField } from './fieldStorage'
import type {
  AgentProvisioning,
  Field,
  MeetingActionStatus,
  MeetingEntryKind,
} from './fieldTypes'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const entryClasses: Record<MeetingEntryKind, string> = {
  argument: 'border-emerald-500/20 bg-emerald-500/6',
  counterargument: 'border-rose-500/20 bg-rose-500/6',
  evidence: 'border-sky-500/20 bg-sky-500/6',
  decision: 'border-amber-500/20 bg-amber-500/6',
}

const entryLabelClasses: Record<MeetingEntryKind, string> = {
  argument: 'text-emerald-300',
  counterargument: 'text-rose-300',
  evidence: 'text-sky-300',
  decision: 'text-amber-300',
}

const provisioningClasses: Record<AgentProvisioning, string> = {
  hosted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  connected: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
}

const actionStatusClasses: Record<MeetingActionStatus, string> = {
  approved: 'text-emerald-300',
  queued: 'text-amber-300',
  'needs-human': 'text-sky-300',
}

function formatUsd(value: number) {
  return currencyFormatter.format(value)
}

function getParticipant(field: Field, participantId: string) {
  if (participantId === field.owner.id) {
    return {
      id: field.owner.id,
      name: field.owner.name,
      role: field.owner.role,
      kind: 'human' as const,
    }
  }

  const agent = field.council.find((member) => member.id === participantId)
  if (agent) {
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      kind: 'agent' as const,
      provisioning: agent.provisioning,
      wallet: agent.wallet,
    }
  }

  return {
    id: participantId,
    name: 'Unknown participant',
    role: 'Unknown',
    kind: 'human' as const,
  }
}

export default function MeetingView() {
  const { id } = useParams<{ id: string }>()
  const field = id ? loadField(id) : undefined

  if (!field) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">Meeting not found</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          That field meeting does not exist.
        </h1>
        <p className="mt-3 text-neutral-400">
          Return to the field workspace to open one of the seeded meeting views.
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

  const citedSourceIds = Array.from(
    new Set(
      field.meeting.entries.flatMap((entry) => entry.citations?.map((citation) => citation.sourceId) ?? []),
    ),
  )
  const citedSources = citedSourceIds
    .map((sourceId) => field.sourceLibrary.find((source) => source.id === sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source))

  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_42%)]">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-5 flex items-center gap-2 text-sm text-neutral-500">
            <Link to="/fields" className="transition-colors hover:text-white">
              Fields
            </Link>
            <span>/</span>
            <Link to={`/field/${field.id}`} className="transition-colors hover:text-white">
              {field.name}
            </Link>
            <span>/</span>
            <span className="text-neutral-300">Meeting</span>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
                Meeting View
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                {field.meeting.title}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-neutral-300">
                {field.meeting.summary}
              </p>
              <p className="mt-4 text-sm text-neutral-500">Updated {field.meeting.updatedAt}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={`/field/${field.id}`}
                className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Back to Field
              </Link>
              <Link
                to="/hire-agents"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
              >
                Staff Another Agent
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Participants in room</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {field.meeting.participantIds.length}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Cited sources</p>
              <p className="mt-2 text-3xl font-semibold text-white">{citedSources.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Proposed actions</p>
              <p className="mt-2 text-3xl font-semibold text-white">{field.meeting.actions.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Pending human approvals</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {field.meeting.actions.filter((action) => action.status === 'needs-human').length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1.35fr_0.95fr]">
        <section className="space-y-4">
          {field.meeting.entries.map((entry) => {
            const participant = getParticipant(field, entry.authorId)

            return (
              <article
                key={entry.id}
                className={`rounded-3xl border p-6 ${entryClasses[entry.kind]}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-medium uppercase tracking-[0.18em] ${entryLabelClasses[entry.kind]}`}
                      >
                        {entry.kind}
                      </span>
                      {participant.kind === 'agent' && participant.provisioning ? (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${provisioningClasses[participant.provisioning]}`}
                        >
                          {participant.provisioning}
                        </span>
                      ) : (
                        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-300">
                          Human
                        </span>
                      )}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-white">{entry.headline}</h2>
                    <p className="mt-2 text-sm text-neutral-400">
                      {participant.name} - {participant.role}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">{entry.at}</span>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-neutral-200">{entry.body}</p>

                {entry.citations?.length ? (
                  <div className="mt-5 space-y-3">
                    {entry.citations.map((citation) => {
                      const source = field.sourceLibrary.find(
                        (item) => item.id === citation.sourceId,
                      )

                      return (
                        <div
                          key={`${entry.id}-${citation.sourceId}`}
                          className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium text-white">{source?.title ?? 'Source'}</p>
                            <span className="text-xs text-neutral-500">{source?.addedAt}</span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                            {citation.note}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
                            {source?.kind ?? 'source'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>

        <aside className="space-y-8">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Participants and wallets</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Hosted agents keep separate wallets in the same room so funding and action stay legible.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <p className="font-medium text-white">{field.owner.name}</p>
                <p className="mt-1 text-sm text-neutral-400">{field.owner.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                  Brings the conviction, joins or watches meetings, and approves actions when the council asks for judgment.
                </p>
              </div>

              {field.council.map((agent) => (
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
                      <p className="mt-2 font-semibold text-white">
                        {formatUsd(agent.wallet.balanceUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Allocated</p>
                      <p className="mt-2 font-semibold text-white">
                        {formatUsd(agent.wallet.allocatedUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Month to date</p>
                      <p className="mt-2 font-semibold text-white">
                        {formatUsd(agent.wallet.monthlySpendUsd)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Proposed actions</h2>
            <div className="mt-5 space-y-3">
              {field.meeting.actions.map((action) => {
                const owner = getParticipant(field, action.ownerId)
                return (
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
                    <p className="mt-2 text-sm text-neutral-400">Owner: {owner.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                      {action.rationale}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Unresolved tensions</h2>
            <div className="mt-5 space-y-3">
              {field.meeting.tensions.map((tension) => (
                <div
                  key={tension}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm leading-relaxed text-neutral-300"
                >
                  {tension}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Cited sources</h2>
            <div className="mt-5 space-y-3">
              {citedSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
                >
                  <p className="font-medium text-white">{source.title}</p>
                  <p className="mt-1 text-sm text-neutral-400">{source.author}</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {source.relevance}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
