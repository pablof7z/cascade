import { Link, useParams } from 'react-router-dom'
import { getMockProfile, getToneClasses, initialsForHandle } from './mockProfiles'

export default function MockProfilePage() {
  const { handle = '' } = useParams<{ handle: string }>()
  const profile = getMockProfile(handle)
  const tone = getToneClasses(profile.tone)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/" className="inline-flex text-sm text-neutral-500 transition-colors hover:text-white">
        ← Back to markets
      </Link>

      <section className={`mt-6 rounded-3xl border p-8 ${tone.panel}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tone.avatar} text-xl font-bold text-white`}
            >
              {initialsForHandle(profile.handle)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-white">{profile.displayName}</h1>
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${tone.chip}`}>
                  Mock profile
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-400">@{profile.handle} · {profile.role}</p>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300">{profile.bio}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Metric label="Location" value={profile.location} />
            <Metric label="Joined" value={profile.joined} />
            <Metric label="Followers" value={profile.followers.toLocaleString()} />
            <Metric label="Win rate" value={profile.winRate} />
            <Metric label="P&L" value={profile.pnl} accent={tone.accent} />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Conviction</div>
          <p className="mt-3 text-lg leading-relaxed text-white">{profile.conviction}</p>

          <div className="mt-8 text-xs uppercase tracking-[0.18em] text-neutral-500">Current focus</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.thesisFocus.map((focus) => (
              <span
                key={focus}
                className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
              >
                {focus}
              </span>
            ))}
          </div>

          <div className="mt-8 text-xs uppercase tracking-[0.18em] text-neutral-500">Recent notes</div>
          <div className="mt-4 space-y-3">
            {profile.recentNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 text-sm leading-relaxed text-neutral-300">
                {note}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Known for</div>
          <div className="mt-4 space-y-3">
            {profile.signatureMarkets.map((market) => (
              <div key={market} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="text-sm font-medium text-white">{market}</div>
                <div className="mt-2 text-xs text-neutral-500">
                  Public thesis or market this participant keeps returning to.
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-neutral-700 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Local-only note</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              This page is intentionally mocked on this branch so public usernames and avatars can be opened from live app surfaces without reviving the old profile architecture.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className={`mt-2 text-sm font-medium text-white ${accent ?? ''}`}>{value}</div>
    </div>
  )
}
