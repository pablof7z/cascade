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

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Active fields</p>
              <p className="mt-2 text-3xl font-semibold text-white">{fields.length}</p>
              <p className="mt-2 text-sm text-neutral-500">
                Fields stay bounded by your judgment, not random topics.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Meetings awaiting judgment</p>
              <p className="mt-2 text-3xl font-semibold text-white">{meetingsAwaiting.length}</p>
              <p className="mt-2 text-sm text-neutral-500">
                Visible disagreements that need a human call.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Hosted agent wallets</p>
              <p className="mt-2 text-3xl font-semibold text-white">{hostedAgents}</p>
              <p className="mt-2 text-sm text-neutral-500">
                Each hosted agent keeps a separate wallet inside the field.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <p className="text-sm text-neutral-400">Capital deployed by field</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatUsd(totalDeployed)}</p>
              <p className="mt-2 text-sm text-neutral-500">
                Capital stays downstream of the research room.
              </p>
            </div>
          </div>
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

          <div className="grid gap-6 xl:grid-cols-3">
            {fields.map((field) => {
              const source = latestSource(field)
              const hostedCount = field.council.filter(
                (agent) => agent.provisioning === 'hosted',
              ).length
              const connectedCount = field.council.length - hostedCount

              return (
                <div
                  key={field.id}
                  className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6"
                >
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

                  <h3 className="mt-5 text-2xl font-semibold text-white">{field.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">{field.summary}</p>
                  <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                    {field.conviction}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Theses & questions
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {field.topics.length}
                      </p>
                      <p className="mt-2 text-sm text-neutral-400">{field.topics[0]?.title}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Meeting status
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {needsHumanActions(field)}
                      </p>
                      <p className="mt-2 text-sm text-neutral-400">
                        action{needsHumanActions(field) === 1 ? '' : 's'} waiting on you
                      </p>
                    </div>
                  </div>

                  {source ? (
                    <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Latest source
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{source.title}</p>
                          <p className="mt-1 text-sm text-neutral-400">
                            {sourceKindLabels[source.kind]} by {source.author}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-neutral-500">{source.addedAt}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-neutral-400">
                    <span>{field.council.length} council members</span>
                    <span>{hostedCount} hosted</span>
                    <span>{connectedCount} connected</span>
                    <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
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

            <div className="mt-6 space-y-4">
              {meetingsAwaiting.map((field) => (
                <div
                  key={field.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        {field.name}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {field.meeting.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                        {field.meeting.summary}
                      </p>
                    </div>
                    <Link
                      to={`/field/${field.id}/meeting`}
                      className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      Review Meeting
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-400">
                    <span>{field.meeting.updatedAt}</span>
                    <span>{needsHumanActions(field)} action items need approval</span>
                    <span>{field.meeting.tensions.length} unresolved tensions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-2xl font-semibold text-white">Latest source additions</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              The library is part of the field itself. New sources are what give the council
              context worth debating.
            </p>

            <div className="mt-6 space-y-4">
              {recentSources.map(({ field, source }) => (
                <div key={`${field.id}-${source.id}`} className="border-b border-neutral-800 pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-white">{source.title}</p>
                    <span className="shrink-0 text-xs text-neutral-500">{source.addedAt}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {sourceKindLabels[source.kind]} in {field.name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{source.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
