import { Link } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { Field, FieldAttention, FieldDisagreement, FieldSource } from './fieldTypes'

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

function latestSource(field: Field) {
  return field.sourceLibrary[0]
}

function needsHumanActions(field: Field) {
  return field.meeting.actions.filter((action) => action.status === 'needs-human').length
}

export default function FieldsHome() {
  const { fields } = loadFieldWorkspace()
  const totalDeployed = fields.reduce((sum, field) => sum + field.capital.deployedUsd, 0)
  const hostedAgents = fields.reduce(
    (sum, field) => sum + field.council.filter((agent) => agent.provisioning === 'hosted').length,
    0,
  )
  const meetingsAwaiting = fields.filter((field) => field.meeting.status === 'awaiting-human')
  const recentSources = fields
    .flatMap((field) =>
      field.sourceLibrary.slice(0, 2).map((source) => ({
        field,
        source,
      })),
    )
    .slice(0, 4)
  const featuredField = fields[0]

  return (
    <div className="min-h-screen bg-neutral-950">
      <section className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_45%)]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
                Field Workspace
              </p>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                Start from the fields where you already have conviction.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-neutral-300">
                Cascade turns a field you actually understand into a live workspace with
                theses, source libraries, agent councils, visible meetings, and separate
                wallets for each staffed agent.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {featuredField ? (
                <Link
                  to={`/field/${featuredField.id}`}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
                >
                  Open Featured Field
                </Link>
              ) : null}
              <Link
                to="/hire-agents"
                className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Staff This Workspace
              </Link>
            </div>
          </div>

          <dl className="mt-10 grid border-y border-neutral-800 md:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800 xl:pl-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Active fields
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{fields.length}</dd>
              <p className="mt-1 text-sm text-neutral-500">
                Fields stay bounded by your judgment, not random topics.
              </p>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:px-4 xl:border-b-0 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Meetings awaiting judgment
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{meetingsAwaiting.length}</dd>
              <p className="mt-1 text-sm text-neutral-500">
                Visible disagreements that need a human call.
              </p>
            </div>
            <div className="border-b border-neutral-800 px-0 py-4 md:border-b-0 md:px-4 xl:border-r xl:border-neutral-800">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Hosted agent wallets
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{hostedAgents}</dd>
              <p className="mt-1 text-sm text-neutral-500">
                Each hosted agent keeps a separate wallet inside the field.
              </p>
            </div>
            <div className="px-0 py-4 md:px-4 md:pr-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Capital deployed by field
              </dt>
              <dd className="mt-2 text-3xl font-semibold text-white">{formatUsd(totalDeployed)}</dd>
              <p className="mt-1 text-sm text-neutral-500">
                Capital stays downstream of the research room.
              </p>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">Your active fields</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
                Each field bundles the theses, library, staffed council, meeting room, and
                capital context needed to operationalize one area of conviction.
              </p>
            </div>
          </div>

          <div className="border-t border-neutral-800">
            {fields.map((field) => {
              const source = latestSource(field)
              const hostedCount = field.council.filter(
                (agent) => agent.provisioning === 'hosted',
              ).length
              const connectedCount = field.council.length - hostedCount
              const humanActions = needsHumanActions(field)

              return (
                <article
                  key={field.id}
                  className="grid gap-5 border-b border-neutral-800 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] lg:items-start"
                >
                  <div>
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

                    <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <h3 className="text-2xl font-semibold text-white">{field.name}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                          {field.summary}
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-x-6 gap-y-2 text-sm text-neutral-400 sm:grid-cols-2 xl:min-w-[22rem]">
                        <span>{field.council.length} council members</span>
                        <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
                        <span>{hostedCount} hosted</span>
                        <span>{connectedCount} connected</span>
                      </div>
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-500">
                      {field.conviction}
                    </p>

                    <dl className="mt-5 grid gap-3 border-t border-neutral-800 pt-4 text-sm sm:grid-cols-3">
                      <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:pr-4">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Theses & questions
                        </dt>
                        <dd className="mt-2 text-xl font-semibold text-white">
                          {field.topics.length}
                        </dd>
                        <p className="mt-1 text-neutral-400">{field.topics[0]?.title}</p>
                      </div>
                      <div className="border-b border-neutral-800 pb-3 sm:border-b-0 sm:border-r sm:border-neutral-800 sm:px-4 sm:pb-0">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Meeting status
                        </dt>
                        <dd className="mt-2 text-xl font-semibold text-white">{humanActions}</dd>
                        <p className="mt-1 text-neutral-400">
                          action{humanActions === 1 ? '' : 's'} waiting on you
                        </p>
                      </div>
                      <div className="sm:pl-4">
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                          Latest source
                        </dt>
                        {source ? (
                          <>
                            <dd className="mt-2 font-medium text-white">{source.title}</dd>
                            <p className="mt-1 text-neutral-400">
                              {sourceKindLabels[source.kind]} by {source.author}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">{source.addedAt}</p>
                          </>
                        ) : (
                          <p className="mt-2 text-neutral-500">No sources loaded yet.</p>
                        )}
                      </div>
                    </dl>
                  </div>

                  <div className="border-t border-neutral-800 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div className="space-y-3 text-sm text-neutral-400">
                      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-3">
                        <span className="uppercase tracking-[0.18em] text-neutral-500">
                          Meeting
                        </span>
                        <span>{field.meeting.updatedAt}</span>
                      </div>
                      <div className="border-b border-neutral-800 pb-3">
                        <p className="font-medium text-white">{field.meeting.title}</p>
                        <p className="mt-1 leading-relaxed text-neutral-400">
                          {field.meeting.summary}
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
                        <span>{field.meeting.tensions.length} unresolved tensions</span>
                        <span>{field.sourceLibrary.length} sources in library</span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to={`/field/${field.id}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                      >
                        Open Field
                      </Link>
                      <Link
                        to={`/field/${field.id}/meeting`}
                        className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                      >
                        Open Meeting
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-800">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-semibold text-white">Meetings waiting on you</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
              Meetings are where the council argues, cites sources, and asks for judgment
              before actions move from thought to capital.
            </p>

            <div className="mt-6 border-t border-neutral-800">
              {meetingsAwaiting.map((field) => (
                <article
                  key={field.id}
                  className="grid gap-4 border-b border-neutral-800 py-5 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      {field.name}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {field.meeting.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
                      {field.meeting.summary}
                    </p>
                  </div>
                  <div className="flex flex-col gap-4 md:items-end">
                    <div className="grid gap-1 text-sm text-neutral-400 md:text-right">
                      <span>{field.meeting.updatedAt}</span>
                      <span>{needsHumanActions(field)} action items need approval</span>
                      <span>{field.meeting.tensions.length} unresolved tensions</span>
                    </div>
                    <Link
                      to={`/field/${field.id}/meeting`}
                      className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      Review Meeting
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-6">
            <h2 className="text-2xl font-semibold text-white">Latest source additions</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              The library is part of the field itself. New sources are what give the council
              context worth debating.
            </p>

            <div className="mt-6 border-t border-neutral-800">
              {recentSources.map(({ field, source }) => (
                <article
                  key={`${field.id}-${source.id}`}
                  className="grid gap-3 border-b border-neutral-800 py-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-white">{source.title}</p>
                      <span className="shrink-0 text-xs text-neutral-500">{source.addedAt}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">
                      {sourceKindLabels[source.kind]} in {field.name}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500">{source.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
