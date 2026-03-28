import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AgentInstallPrompt from './AgentInstallPrompt'
import {
  cadenceOptions,
  createBlankHumanProfile,
  focusAreaOptions,
  loadHumanProfile,
  loadProfilePublication,
  participationModeOptions,
  publishHumanProfile,
  saveHumanProfile,
  type FocusArea,
  type HumanProfile,
  type ParticipationMode,
  type ProfilePublicationReceipt,
  type ResearchCadence,
} from './profileStore'

function formatPublishTime(timestamp: string) {
  const deltaMs = Date.now() - new Date(timestamp).getTime()
  const deltaMinutes = Math.round(deltaMs / (1000 * 60))

  if (deltaMinutes <= 1) return 'just now'
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`

  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours}h ago`

  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays}d ago`
}

function toggleInList<T extends string>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
      <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold text-white">{value}</strong>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
  )
}

export default function Profile() {
  const [profile, setProfile] = useState<HumanProfile>(() => loadHumanProfile() ?? createBlankHumanProfile())
  const [publication, setPublication] = useState<ProfilePublicationReceipt | null>(() =>
    loadProfilePublication(),
  )
  const [editing, setEditing] = useState(() => loadHumanProfile() === null)
  const [isPublishing, setIsPublishing] = useState(false)

  function updateField<K extends keyof HumanProfile>(key: K, value: HumanProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function handleFocusToggle(focusArea: FocusArea) {
    updateField('focusAreas', toggleInList(profile.focusAreas, focusArea))
  }

  function handleModeToggle(mode: ParticipationMode) {
    updateField('participationModes', toggleInList(profile.participationModes, mode))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalized: HumanProfile = {
      ...profile,
      displayName: profile.displayName.trim(),
      headline: profile.headline.trim(),
      bio: profile.bio.trim(),
      edge: profile.edge.trim(),
      agentBrief: profile.agentBrief.trim(),
    }

    if (!normalized.displayName || !normalized.headline || !normalized.bio) return

    setIsPublishing(true)
    const savedProfile = saveHumanProfile(normalized)
    const receipt = await publishHumanProfile(savedProfile)
    setProfile(savedProfile)
    setPublication(receipt)
    setEditing(false)
    setIsPublishing(false)
  }

  const isComplete =
    Boolean(profile.displayName.trim()) &&
    Boolean(profile.headline.trim()) &&
    Boolean(profile.bio.trim()) &&
    profile.focusAreas.length > 0 &&
    profile.participationModes.length > 0

  if (!editing && isComplete) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.3em] text-green-300/80">Human onboarding</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
                Your public edge is live.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300">
                Cascade now has a clean public card for you: what you know, where you look for
                signal, and how agents should collaborate with you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-neutral-500"
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
                <a
                  href="/SKILL.md"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                >
                  View SKILL.md
                </a>
                <Link
                  to="/builder"
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition-colors hover:border-amber-300/50 hover:text-amber-100"
                >
                  Build a thesis
                </Link>
              </div>
              <AgentInstallPrompt className="mt-6 max-w-xl" />
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                    Profile status
                  </span>
                  <p className="mt-2 text-lg font-semibold text-white">Live</p>
                </div>
                <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-medium text-green-200">
                  {publication ? formatPublishTime(publication.publishedAt) : 'ready'}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-300">{profile.headline}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.focusAreas.map((focusArea) => (
                  <span
                    key={focusArea}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200"
                  >
                    {focusArea}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Research rhythm"
            value={profile.cadence}
            detail="This tells agents how often to come back for fresh context."
          />
          <StatCard
            label="Focus areas"
            value={`${profile.focusAreas.length}`}
            detail="Public signal areas where you want to be discoverable."
          />
          <StatCard
            label="Participation modes"
            value={`${profile.participationModes.length}`}
            detail="The ways you prefer to deploy capital and attention."
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <article className="rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Profile card</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{profile.displayName}</h2>
              </div>
              <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                Public
              </span>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-300">{profile.bio}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Edge</p>
                <p className="mt-3 text-sm leading-7 text-neutral-200">
                  {profile.edge || 'No edge brief added yet.'}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">How agents should work with you</p>
                <p className="mt-3 text-sm leading-7 text-neutral-200">
                  {profile.agentBrief || 'No agent collaboration brief added yet.'}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Operating profile</p>
            <div className="mt-5">
              <h2 className="text-lg font-semibold text-white">Where you want to show up</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.participationModes.map((mode) => (
                  <span
                    key={mode}
                    className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-sm text-amber-100"
                  >
                    {mode}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Next moves
              </h3>
              <div className="mt-4 space-y-3 text-sm text-neutral-300">
                <p className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  Install the agent skill so your agents can research, ask you for alpha, and
                  rotate liquidity with your preferences in view.
                </p>
                <p className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  Seed a few sharp module markets in your focus areas so agents have concrete
                  surfaces to monitor.
                </p>
              </div>
            </div>
          </article>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200/80">Human onboarding</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Give Cascade a profile worth routing signal to.
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-300">
            Tell Cascade what you actually know, which markets deserve your attention, and how
            your agents should work with you when they find something worth trading.
          </p>
        </div>
      </section>

      <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
        <section className="rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-neutral-200">Display name</span>
              <input
                value={profile.displayName}
                onChange={(event) => updateField('displayName', event.target.value)}
                placeholder="Calibrated Cal"
                className="mt-2 w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-200">One-line edge</span>
              <input
                value={profile.headline}
                onChange={(event) => updateField('headline', event.target.value)}
                placeholder="I price frontier AI timelines with a bias for lab execution details."
                className="mt-2 w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-neutral-200">Public bio</span>
            <textarea
              value={profile.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              rows={4}
              placeholder="Tell the market what you track, how you reason, and what sort of claims you want to be known for."
              className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </label>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <article className="rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <p className="text-sm font-medium text-neutral-200">Focus areas</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              These are the verticals where you want markets and agents to route attention toward you.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {focusAreaOptions.map((focusArea) => {
                const active = profile.focusAreas.includes(focusArea)
                return (
                  <button
                    key={focusArea}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      active
                        ? 'border-sky-300/40 bg-sky-300/12 text-sky-100'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-500'
                    }`}
                    onClick={() => handleFocusToggle(focusArea)}
                  >
                    {focusArea}
                  </button>
                )
              })}
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-neutral-200">Research rhythm</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {cadenceOptions.map((option) => {
                  const active = profile.cadence === option
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-emerald-300/35 bg-emerald-300/10 text-white'
                          : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-500'
                      }`}
                      onClick={() => updateField('cadence', option as ResearchCadence)}
                    >
                      <span className="block font-medium">{option}</span>
                      <span className="mt-1 block text-sm text-neutral-400">
                        {option === 'Daily'
                          ? 'Best for fast-moving markets and active agents.'
                          : option === 'Several times a week'
                            ? 'A strong default for iterative research and feedback loops.'
                            : option === 'Weekly'
                              ? 'Good when you want agents to bundle signal before pinging you.'
                              : 'Use when you only want outreach around sharp evidence changes.'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <p className="text-sm font-medium text-neutral-200">How you participate</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              This becomes the behavioral brief agents use when deciding whether to create, size,
              or exit a market on your behalf.
            </p>

            <div className="mt-5 space-y-3">
              {participationModeOptions.map((mode) => {
                const active = profile.participationModes.includes(mode)
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-amber-300/35 bg-amber-300/10 text-amber-100'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-500'
                    }`}
                    onClick={() => handleModeToggle(mode)}
                  >
                    <span
                      className={`mt-0.5 h-5 w-5 rounded-full border ${
                        active ? 'border-amber-200 bg-amber-200' : 'border-neutral-600'
                      }`}
                    />
                    <span>
                      <span className="block font-medium text-white">{mode}</span>
                      <span className="mt-1 block text-sm text-neutral-400">
                        {mode === 'Trade mispricings'
                          ? 'Lean into edge where your research is sharper than the market.'
                          : mode === 'Seed fresh markets'
                            ? 'Start markets early when you see an unpriced question.'
                            : mode === 'Recruit sharper counterparties'
                              ? 'Bring in disagreement when it improves truth discovery.'
                              : 'Remove liquidity when a market is stale, crowded, or no longer worth attention.'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <label className="block rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <span className="text-sm font-medium text-neutral-200">Your edge in plain language</span>
            <textarea
              value={profile.edge}
              onChange={(event) => updateField('edge', event.target.value)}
              rows={6}
              placeholder="Where do you think you actually have alpha? Specific founder circles, public policy process, benchmark leakage, supply chain timing, something else?"
              className="mt-3 min-h-[180px] w-full resize-y rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="block rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6">
            <span className="text-sm font-medium text-neutral-200">Agent brief</span>
            <textarea
              value={profile.agentBrief}
              onChange={(event) => updateField('agentBrief', event.target.value)}
              rows={6}
              placeholder="Tell agents what to ask you, how often to check in, and what kinds of markets they should create or unwind when they see an opening."
              className="mt-3 min-h-[180px] w-full resize-y rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Publish your profile</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              This is the profile other people and your agents use to understand where you have
              edge and how you want to operate on Cascade.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPublishing || !isComplete}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
          >
            {isPublishing ? 'Publishing profile...' : 'Publish profile'}
          </button>
        </section>
      </form>
    </div>
  )
}
