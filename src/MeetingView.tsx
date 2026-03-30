import { Link, useParams } from 'react-router-dom'
import { loadField } from './fieldStorage'
import type {
  AgentProvisioning,
  Field,
  MeetingActionStatus,
  MeetingEntryKind,
  MeetingStatus,
} from './fieldTypes'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const entryClasses: Record<MeetingEntryKind, string> = {
  argument: 'border-l-2 border-emerald-500/60',
  counterargument: 'border-l-2 border-rose-500/60',
  evidence: 'border-l-2 border-sky-500/60',
  decision: 'border-l-2 border-amber-500/60',
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

const meetingStatusClasses: Record<MeetingStatus, string> = {
  live: 'text-emerald-300',
  watching: 'text-amber-300',
  'awaiting-human': 'text-sky-300',
}

const meetingStatusLabels: Record<MeetingStatus, string> = {
  live: 'Live now',
  watching: 'Watching',
  'awaiting-human': 'Awaiting your call',
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
  const pendingHumanApprovals = field.meeting.actions.filter(
    (action) => action.status === 'needs-human',
  ).length

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
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Meeting View</p>
                <span
                  className={`text-xs font-medium uppercase tracking-[0.18em] ${meetingStatusClasses[field.meeting.status]}`}
                >
                  {meetingStatusLabels[field.meeting.status]}
                </span>
              </div>
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

          <dl className="mt-10 grid border-y border-neutral-800 md:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800 xl:pl-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Participants in room
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">
                {field.meeting.participantIds.length}
              </dd>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Cited sources
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{citedSources.length}</dd>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:border-b-0 md:px-4 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Proposed actions
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{field.meeting.actions.length}</dd>
            </div>
            <div className="px-0 py-4 md:px-4 md:pr-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Pending human approvals
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{pendingHumanApprovals}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-[1.35fr_0.95fr]">
        <section className="border-t border-neutral-800">
          {field.meeting.entries.map((entry) => {
            const participant = getParticipant(field, entry.authorId)

            return (
              <article key={entry.id} className={`border-b border-neutral-800 py-5 pl-4 md:pl-5 ${entryClasses[entry.kind]}`}>
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
                    <h2 className="mt-3 text-xl font-semibold text-white">{entry.headline}</h2>
                    <p className="mt-2 text-sm text-neutral-400">
                      {participant.name} - {participant.role}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">{entry.at}</span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-neutral-200">{entry.body}</p>

                {entry.citations?.length ? (
                  <div className="mt-4 space-y-3 border-l border-neutral-800 pl-4">
                    {entry.citations.map((citation) => {
                      const source = field.sourceLibrary.find(
                        (item) => item.id === citation.sourceId,
                      )

                      return (
                        <div key={`${entry.id}-${citation.sourceId}`} className="grid gap-1">
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

        <aside className="space-y-6">
          <section className="border-t border-neutral-800 pt-5">
            <h2 className="text-xl font-semibold text-white">Participants and wallets</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Hosted agents keep separate wallets in the same room so funding and action stay legible.
            </p>

            <div className="mt-5 space-y-4">
              <div className="border-b border-neutral-800 pb-4">
                <p className="font-medium text-white">{field.owner.name}</p>
                <p className="mt-1 text-sm text-neutral-400">{field.owner.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                  Brings the conviction, joins or watches meetings, and approves actions when the council asks for judgment.
                </p>
              </div>

              {field.council.map((agent) => (
                <div key={agent.id} className="border-b border-neutral-800 pb-4 last:border-b-0">
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

                  <dl className="mt-4 grid gap-3 border-t border-neutral-800 pt-3 text-sm sm:grid-cols-3">
                    <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-3">
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        Balance
                      </dt>
                      <dd className="mt-2 font-semibold text-white">
                        {formatUsd(agent.wallet.balanceUsd)}
                      </dd>
                    </div>
                    <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-3 sm:pb-0">
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
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-neutral-800 pt-5">
            <h2 className="text-xl font-semibold text-white">Proposed actions</h2>
            <div className="mt-4 space-y-4">
              {field.meeting.actions.map((action) => {
                const owner = getParticipant(field, action.ownerId)
                return (
                  <div key={action.id} className="border-b border-neutral-800 pb-4 last:border-b-0">
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

          <section className="border-t border-neutral-800 pt-5">
            <h2 className="text-xl font-semibold text-white">Unresolved tensions</h2>
            <div className="mt-4 space-y-3">
              {field.meeting.tensions.map((tension) => (
                <div
                  key={tension}
                  className="border-l border-neutral-700 pl-3 text-sm leading-relaxed text-neutral-300"
                >
                  {tension}
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-neutral-800 pt-5">
            <h2 className="text-xl font-semibold text-white">Cited sources</h2>
            <div className="mt-4 space-y-4">
              {citedSources.map((source) => (
                <div key={source.id} className="border-b border-neutral-800 pb-4 last:border-b-0">
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
