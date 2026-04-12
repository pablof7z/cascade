export const focusAreaOptions = [
  'AI & Compute',
  'Biotech & Health',
  'Energy & Climate',
  'Governance & Society',
  'Space & Frontier',
  'Crypto & Macro',
] as const

export const cadenceOptions = [
  'Daily',
  'Several times a week',
  'Weekly',
  'Event-driven',
] as const

export const participationModeOptions = [
  'Trade mispricings',
  'Seed fresh markets',
  'Recruit sharper counterparties',
  'Pull liquidity from stale markets',
] as const

export type FocusArea = (typeof focusAreaOptions)[number]
export type ResearchCadence = (typeof cadenceOptions)[number]
export type ParticipationMode = (typeof participationModeOptions)[number]

export type HumanProfile = {
  displayName: string
  headline: string
  bio: string
  focusAreas: FocusArea[]
  cadence: ResearchCadence
  participationModes: ParticipationMode[]
  edge: string
  agentBrief: string
  updatedAt: string
}

export type ProfilePublicationReceipt = {
  reference: string
  publishedAt: string
  delivery: 'simulated'
}

type SerializedProfileEnvelope = {
  receipt: ProfilePublicationReceipt
  event: {
    id: string
    kind: 0
    created_at: number
    content: string
  }
}

const PROFILE_KEY = 'cascade-human-profile'
const PROFILE_PUBLICATION_KEY = 'cascade-human-profile-publication'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function makeId(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefix}-${suffix}`
}

export function createBlankHumanProfile(): HumanProfile {
  return {
    displayName: '',
    headline: '',
    bio: '',
    focusAreas: ['AI & Compute'],
    cadence: 'Several times a week',
    participationModes: ['Trade mispricings', 'Seed fresh markets'],
    edge: '',
    agentBrief: '',
    updatedAt: '',
  }
}

export function loadHumanProfile(): HumanProfile | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as HumanProfile
  } catch {
    return null
  }
}

export function saveHumanProfile(profile: HumanProfile): HumanProfile {
  const nextProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  }

  if (canUseStorage()) {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
  }

  return nextProfile
}

export function loadProfilePublication(): ProfilePublicationReceipt | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(PROFILE_PUBLICATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SerializedProfileEnvelope
    return parsed.receipt
  } catch {
    return null
  }
}

export async function publishHumanProfile(
  profile: HumanProfile,
): Promise<ProfilePublicationReceipt> {
  const publishedAt = new Date().toISOString()
  const receipt: ProfilePublicationReceipt = {
    reference: makeId('profile'),
    publishedAt,
    delivery: 'simulated',
  }

  const envelope: SerializedProfileEnvelope = {
    receipt,
    event: {
      id: receipt.reference,
      kind: 0,
      created_at: Math.floor(new Date(publishedAt).getTime() / 1000),
      content: JSON.stringify(profile),
    },
  }

  await new Promise((resolve) => window.setTimeout(resolve, 360))

  if (canUseStorage()) {
    window.localStorage.setItem(PROFILE_PUBLICATION_KEY, JSON.stringify(envelope))
  }

  return receipt
}

