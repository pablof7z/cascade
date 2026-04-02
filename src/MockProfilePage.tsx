import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadFieldWorkspace } from './fieldStorage'
import type { Field } from './fieldTypes'
import { getMockProfile, getToneClasses, initialsForHandle, normalizeHandle } from './mockProfiles'
import { loadHumanProfile } from './profileStore'

export default function MockProfilePage() {
  const { handle = '' } = useParams<{ handle: string }>()
  const normalizedHandle = normalizeHandle(handle)
  const isOwnProfile = normalizedHandle === 'you'
  const humanProfile = isOwnProfile ? loadHumanProfile() : null
  const [isFollowing, setIsFollowing] = useState(false)
  const fields = loadFieldWorkspace().fields

  if (isOwnProfile && !humanProfile) {
    const emptyTone = getToneClasses('emerald')

    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link to="/" className="inline-flex text-sm text-neutral-500 transition-colors hover:text-white">
            ← Back to markets
          </Link>

          <section
            data-testid="profile-hero"
            className={`mt-6 border px-6 py-8 sm:px-8 ${emptyTone.panel}`}
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center bg-neutral-700 text-2xl font-bold text-white"
                >
                  Y
                </div>

                <div className="max-w-2xl">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-400">Your profile</p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Finish your profile
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300">
                    Save your name, thesis, and participation details before this page goes public.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3" data-testid="hero-actions">
                <Link
                  to="/profile"
                  data-testid="edit-profile-button"
                  className={`px-5 py-3 text-sm font-semibold transition-colors ${emptyTone.button}`}
                >
                  Create profile
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const profile = getMockProfile(handle)
  const tone = getToneClasses(profile.tone)
  const displayName = humanProfile?.displayName.trim() || profile.displayName
  const headline = humanProfile?.headline.trim() || profile.headline
  const bio = humanProfile?.bio.trim() || profile.bio
  const focusAreas = withFallbackItems(
    humanProfile?.focusAreas.length ? humanProfile.focusAreas : profile.focusAreas,
    profile.focusAreas,
  )
  const participationModes = withFallbackItems(
    humanProfile?.participationModes.length ? humanProfile.participationModes : profile.participationModes,
    profile.participationModes,
  )
  const edge = humanProfile?.edge.trim() || profile.edge
  const lastActive = humanProfile?.updatedAt ? formatRelativeTimestamp(humanProfile.updatedAt) : profile.lastActive
  const activeFields = ensureActiveFields(buildActiveFields({ focusAreas, participationModes, edge }, fields), {
    focusAreas,
    participationModes,
    edge,
  })
  const recentActivity = ensureRecentActivity(buildRecentActivity(profile, displayName, edge, activeFields), {
    displayName,
    edge,
    lastActive,
  })
  const credibilityStrip = [
    { label: 'Last active', value: lastActive },
    { label: 'Markets joined', value: profile.marketsParticipated.toLocaleString() },
    { label: 'Fields active', value: String(activeFields.length) },
    { label: 'Followers', value: profile.followers.toLocaleString() },
  ]

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/" className="inline-flex text-sm text-neutral-500 transition-colors hover:text-white">
          ← Back to markets
        </Link>

        <section
          data-testid="profile-hero"
          className={`mt-6 border px-6 py-8 sm:px-8 ${tone.panel}`}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center bg-neutral-700 text-2xl font-bold text-white"
              >
                {initialsForHandle(profile.handle)}
              </div>

              <div className="max-w-3xl">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-400">
                  {profile.role}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {displayName}
                  </h1>
                  <span className="pb-1 text-base text-neutral-400">@{profile.handle}</span>
                </div>
                <p className={`mt-4 max-w-2xl text-xl leading-tight sm:text-2xl ${tone.accent}`}>
                  {headline}
                </p>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300">{bio}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3" data-testid="hero-actions">
              {isOwnProfile ? (
                <Link
                  to="/profile"
                  data-testid="edit-profile-button"
                  className={`px-5 py-3 text-sm font-semibold transition-colors ${tone.button}`}
                >
                  Edit profile
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsFollowing((current) => !current)}
                  data-testid={isFollowing ? 'following-button' : 'follow-button'}
                  aria-label={isFollowing ? 'Following' : 'Follow'}
                  className={`px-5 py-3 text-sm font-semibold transition-colors ${tone.button}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              <Link
                to={recentActivity[0]?.to ?? '/dashboard/fields'}
                className="border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Open latest thread
              </Link>
            </div>
          </div>

          <dl
            data-testid="credibility-strip"
            className="credibility-strip mt-8 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {credibilityStrip.map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{item.label}</dt>
                <dd className="mt-2 text-lg font-semibold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
          <div>
            <section
              data-testid="recent-activity"
              className="recent-activity border-t border-neutral-800 pt-8"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Recent activity</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Proof they actually show up.</h2>
                </div>
                <p className="max-w-md text-sm text-neutral-400">
                  Recent threads, notes, and theses that give this profile somewhere real to click next.
                </p>
              </div>

              <div className="mt-6 divide-y divide-neutral-800">
                {recentActivity.map((item) => (
                  <article
                    key={`${item.kind}-${item.title}`}
                    className="grid gap-3 py-5 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                      {item.kind}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">{item.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
                        {item.detail}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="text-xs text-neutral-500">{item.time}</span>
                      <Link
                        to={item.to}
                        className={`text-sm font-medium transition-colors hover:text-white ${tone.accent}`}
                      >
                        {item.cta} →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              data-testid="active-in"
              className="active-in mt-10 border-t border-neutral-800 pt-8"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Active in</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Where they show up when the debate gets live.</h2>
                </div>
                <Link
                  to="/dashboard/fields"
                  className="text-sm font-medium text-neutral-400 transition-colors hover:text-white"
                >
                  Browse all fields
                </Link>
              </div>

              <div className="mt-6 divide-y divide-neutral-800">
                {activeFields.map((field) => (
                  <div
                    key={`${field.label}-${field.hookTitle}`}
                    className="grid gap-4 py-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
                  >
                    <div>
                      <p className="text-lg font-medium text-white">{field.label}</p>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{field.summary}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-300">{field.verb}</p>
                      <Link
                        to={field.to}
                        className={`mt-3 inline-flex text-sm font-medium transition-colors hover:text-white ${tone.accent}`}
                      >
                        {field.hookLabel}: {field.hookTitle} →
                      </Link>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
                        {field.updatedAt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-10">
            <section className="border-t border-neutral-800 pt-8">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Known for</p>
              <Link
                to={recentActivity[1]?.to ?? '/dashboard/fields'}
                className="mt-3 block text-2xl font-semibold leading-tight text-white transition-colors hover:text-neutral-200"
              >
                {profile.signatureMarkets[0]}
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {displayName} keeps returning to this thesis because it compresses the edge they want
                to defend in public.
              </p>
            </section>

            <section className="border-t border-neutral-800 pt-8">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Areas of conviction</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {focusAreas.map((focus) => (
                  <span
                    key={focus}
                    className={`border px-3 py-1.5 text-sm ${tone.chip}`}
                  >
                    {focus}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">{edge}</p>
            </section>

            <section className="border-t border-neutral-800 pt-8">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">How they participate</p>
              <div className="mt-4 space-y-3">
                {participationModes.slice(0, 3).map((mode) => (
                  <p key={mode} className="text-sm leading-relaxed text-neutral-300">
                    {mode}
                  </p>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

type ActiveFieldRow = {
  label: string
  summary: string
  verb: string
  hookLabel: string
  hookTitle: string
  to: string
  updatedAt: string
}

type ActivityRow = {
  kind: string
  title: string
  detail: string
  time: string
  to: string
  cta: string
}

function buildActiveFields(
  profile: { focusAreas: string[]; participationModes: string[]; edge: string },
  fields: Field[],
): ActiveFieldRow[] {
  const usedFieldIds = new Set<string>()
  const rows: ActiveFieldRow[] = []

  for (const [index, focusArea] of profile.focusAreas.slice(0, 3).entries()) {
    let matchedField = matchFieldToFocus(focusArea, fields)

    if (matchedField && usedFieldIds.has(matchedField.id)) {
      matchedField = undefined
    }

    if (matchedField) {
      usedFieldIds.add(matchedField.id)
      rows.push({
        label: matchedField.name,
        summary: matchedField.recentUpdate,
        verb: profile.participationModes[index % profile.participationModes.length] ?? 'Shows up early',
        hookLabel: matchedField.meeting.status === 'live' ? 'Open live thread' : 'Open current thread',
        hookTitle:
          matchedField.meeting.entries[0]?.headline ??
          matchedField.topics[0]?.title ??
          matchedField.meeting.title,
        to: `/dashboard/field/${matchedField.id}/meeting`,
        updatedAt: matchedField.meeting.updatedAt,
      })
      continue
    }

    rows.push({
      label: focusArea,
      summary: profile.edge,
      verb: profile.participationModes[index % profile.participationModes.length] ?? 'Shows up early',
      hookLabel: 'Search live fields',
      hookTitle: `See current debates connected to ${focusArea}`,
      to: `/dashboard/fields?search=${encodeURIComponent(focusArea)}`,
      updatedAt: 'Live workspace',
    })
  }

  return rows
}

function buildRecentActivity(
  profile: {
    recentNotes: string[]
    signatureMarkets: string[]
    lastActive: string
  },
  displayName: string,
  edge: string,
  activeFields: ActiveFieldRow[],
): ActivityRow[] {
  const [primaryField, secondaryField] = activeFields

  return [
    {
      kind: 'Discussion',
      title: primaryField?.hookTitle ?? 'Current field discussion',
      detail:
        profile.recentNotes[0] ??
        `${displayName} keeps showing up where the argument can still be sharpened in public.`,
      time: primaryField?.updatedAt ?? profile.lastActive,
      to: primaryField?.to ?? '/dashboard/fields',
      cta: primaryField?.hookLabel ?? 'Open thread',
    },
    {
      kind: 'Thesis',
      title: profile.signatureMarkets[0],
      detail: edge,
      time: profile.lastActive,
      to: secondaryField?.to ?? primaryField?.to ?? '/dashboard/fields',
      cta: 'See field context',
    },
    {
      kind: 'Note',
      title: secondaryField?.label ?? 'Areas of conviction',
      detail:
        profile.recentNotes[1] ??
        `${displayName} uses notes to turn broad interest into clearer positions and better timing.`,
      time: secondaryField?.updatedAt ?? 'Earlier today',
      to: secondaryField?.to ?? '/dashboard/fields',
      cta: secondaryField?.hookLabel ?? 'Open field',
    },
  ]
}

function matchFieldToFocus(focusArea: string, fields: Field[]) {
  const normalized = focusArea.toLowerCase()

  if (/(ai|compute|labor|signal|thesis|eval)/.test(normalized)) {
    return fields.find((field) => field.id === 'ai-application-layer')
  }

  if (/(energy|climate|grid|fusion)/.test(normalized)) {
    return fields.find((field) => field.id === 'europe-energy-spread')
  }

  if (/(macro|shipping|migration|border|state|china|policy|geopolit|governance)/.test(normalized)) {
    return fields.find((field) => field.id === 'red-sea-shipping')
  }

  return undefined
}

function formatRelativeTimestamp(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently'
  }

  const elapsedMinutes = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 60000))

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`
  }

  if (elapsedMinutes < 1440) {
    return `${Math.round(elapsedMinutes / 60)}h ago`
  }

  return `${Math.round(elapsedMinutes / 1440)}d ago`
}

function withFallbackItems(items: string[], fallback: string[]) {
  return items.length > 0 ? items : fallback
}

function ensureActiveFields(
  rows: ActiveFieldRow[],
  profile: { focusAreas: string[]; participationModes: string[]; edge: string },
): ActiveFieldRow[] {
  if (rows.length > 0) {
    return rows
  }

  return profile.focusAreas.slice(0, 3).map((focusArea, index) => ({
    label: focusArea,
    summary: profile.edge,
    verb: profile.participationModes[index % profile.participationModes.length] ?? 'Shows up early',
    hookLabel: 'Open live thread',
    hookTitle: `See current debate around ${focusArea}`,
    to: `/dashboard/fields?search=${encodeURIComponent(focusArea)}`,
    updatedAt: 'Live workspace',
  }))
}

function ensureRecentActivity(
  rows: ActivityRow[],
  profile: { displayName: string; edge: string; lastActive: string },
): ActivityRow[] {
  if (rows.length >= 3) {
    return rows
  }

  return [
    {
      kind: 'Discussion',
      title: 'Current field discussion',
      detail: `${profile.displayName} keeps showing up where the argument can still be sharpened in public.`,
      time: profile.lastActive,
      to: '/dashboard/fields',
      cta: 'Open thread',
    },
    {
      kind: 'Thesis',
      title: 'Current conviction',
      detail: profile.edge,
      time: profile.lastActive,
      to: '/dashboard/fields',
      cta: 'See field context',
    },
    {
      kind: 'Note',
      title: 'Areas of conviction',
      detail: `${profile.displayName} uses notes to turn broad interest into clearer positions and better timing.`,
      time: 'Earlier today',
      to: '/dashboard/fields',
      cta: 'Open field',
    },
  ]
}
