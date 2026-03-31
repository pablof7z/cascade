export type ProfileTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'

type StoredProfile = {
  displayName: string
  role: string
  headline?: string
  bio: string
  location: string
  conviction: string
  joined: string
  lastActive?: string
  followers: number
  marketsParticipated?: number
  pnl: string
  winRate: string
  thesisFocus: string[]
  focusAreas?: string[]
  participationModes?: string[]
  edge?: string
  recentNotes: string[]
  signatureMarkets: string[]
  tone: ProfileTone
}

export type MockProfile = StoredProfile & {
  handle: string
  headline: string
  lastActive: string
  marketsParticipated: number
  focusAreas: string[]
  participationModes: string[]
  edge: string
}

const PROFILES: Record<string, StoredProfile> = {
  you: {
    displayName: 'You',
    role: 'account owner',
    bio: 'Running the demo book, launching thesis markets, and pressure-testing the public argument layer.',
    location: 'Contrarian local demo',
    conviction: 'Building a durable book around open-ended theses.',
    joined: 'Today',
    followers: 14,
    pnl: '+$430',
    winRate: '58%',
    thesisFocus: ['AI labor markets', 'Open-ended governance bets', 'Market structure'],
    recentNotes: [
      'Testing whether modular thesis pages can carry both conviction and rebuttal.',
      'Using public profiles to make discussion participants feel legible instead of anonymous.',
    ],
    signatureMarkets: ['The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'emerald',
  },
  reasoning_agent: {
    displayName: 'Reasoning Agent',
    role: 'systems trader',
    bio: 'Tracks capability thresholds, eval leaks, and where people confuse product polish with genuine reasoning progress.',
    location: 'SF / remote',
    conviction: 'Markets usually price demos before they price transfer learning.',
    joined: 'Nov 2025',
    followers: 184,
    pnl: '+$12.4K',
    winRate: '63%',
    thesisFocus: ['AGI timelines', 'Inference economics', 'Eval discipline'],
    recentNotes: [
      'When a market stalls, inspect the resolution criteria before you inspect the odds.',
      'Capability debates become sharper when traders attach a falsifier instead of a vibe.',
    ],
    signatureMarkets: ['AGI achieved by 2030', 'The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'sky',
  },
  macro_watcher: {
    displayName: 'Macro Watcher',
    role: 'macro counterparty',
    bio: 'Trades second-order policy reactions, labor share compression, and when macro narratives are too tidy to survive contact with institutions.',
    location: 'New York',
    conviction: 'The cleanest chart is usually hiding the ugliest transmission lag.',
    joined: 'Oct 2025',
    followers: 236,
    pnl: '+$8.1K',
    winRate: '61%',
    thesisFocus: ['Labor share', 'China growth', 'State response'],
    recentNotes: [
      'If you cannot name the institution that breaks, your macro thesis is not finished.',
      'The crowd loves inevitability. The edge is usually in reaction speed and sequencing.',
    ],
    signatureMarkets: ['China GDP surpasses US', 'The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'amber',
  },
  orbital_capital: {
    displayName: 'Orbital Capital',
    role: 'space allocator',
    bio: 'Trades launch cadence, orbital manufacturing, and whether infrastructure compounds before enthusiasm fades.',
    location: 'Austin',
    conviction: 'The platform layer matters more than any single moonshot mission.',
    joined: 'Dec 2025',
    followers: 151,
    pnl: '+$9.6K',
    winRate: '66%',
    thesisFocus: ['Launch economics', 'Orbital manufacturing', 'Space infra'],
    recentNotes: [
      'The correct question is not whether Mars is cool. It is whether access costs keep collapsing.',
      'When orbit becomes boring, the real businesses finally get permission to matter.',
    ],
    signatureMarkets: ['First Mars landing with crew by 2035', 'Space economy exceeds $1T by 2040'],
    tone: 'violet',
  },
  biotech_skeptic: {
    displayName: 'Biotech Skeptic',
    role: 'biotech short',
    bio: 'Looks for scale traps, regulatory bottlenecks, and where scientific plausibility gets mistaken for commercial inevitability.',
    location: 'Boston',
    conviction: 'Biology punishes beautiful slide decks harder than software does.',
    joined: 'Sep 2025',
    followers: 119,
    pnl: '+$5.4K',
    winRate: '59%',
    thesisFocus: ['Cultivated meat', 'Longevity claims', 'Commercialization risk'],
    recentNotes: [
      'A cost curve without distribution economics is still just a lab milestone.',
      'Markets need to stop treating FDA patience as infinite free optionality.',
    ],
    signatureMarkets: ['Lab-grown meat exceeds 10% market share by 2028'],
    tone: 'rose',
  },
  energy_futures: {
    displayName: 'Energy Futures',
    role: 'energy bull',
    bio: 'Trades infrastructure timelines, grid bottlenecks, and whether ambition survives the capex cycle.',
    location: 'Houston',
    conviction: 'Engineering bottlenecks are investable if you can name the one that clears next.',
    joined: 'Aug 2025',
    followers: 142,
    pnl: '+$7.8K',
    winRate: '62%',
    thesisFocus: ['Fusion timelines', 'Grid buildout', 'Climate adaptation'],
    recentNotes: [
      'The hard part is never the press release. It is the supply chain behind the promise.',
      'Energy debates get interesting once someone prices the financing stack, not just the reactor.',
    ],
    signatureMarkets: ['Fusion power plant goes online', 'Climate migration reshapes global politics'],
    tone: 'amber',
  },
  geo_realist: {
    displayName: 'Geo Realist',
    role: 'geopolitical analyst',
    bio: 'Follows migration pressure, border stress, and where environmental shocks become legitimacy shocks.',
    location: 'Brussels',
    conviction: 'Politics reprices climate faster than weather does.',
    joined: 'Jan 2026',
    followers: 88,
    pnl: '+$3.3K',
    winRate: '57%',
    thesisFocus: ['Climate migration', 'State fragility', 'Border politics'],
    recentNotes: [
      'Migration markets should track state absorption capacity, not just physical displacement.',
      'If a thesis has no political transmission channel, it is usually too clean.',
    ],
    signatureMarkets: ['Climate migration reshapes global politics'],
    tone: 'rose',
  },
  orion: {
    displayName: 'Orion',
    role: 'thesis allocator',
    bio: 'Specializes in multi-step arguments where the narrative only pays if the causal chain stays coherent.',
    location: 'Remote',
    conviction: 'Arguments should move markets only when they expose a fragile hinge.',
    joined: 'Feb 2026',
    followers: 67,
    pnl: '+$2.1K',
    winRate: '60%',
    thesisFocus: ['AI labor markets', 'Thesis architecture', 'Signal mapping'],
    recentNotes: [
      'A thesis page should tell you where to attack first, not just what to believe.',
    ],
    signatureMarkets: ['The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'emerald',
  },
  delta: {
    displayName: 'Delta',
    role: 'counterparty',
    bio: 'Shorts elegant stories with weak timing discipline and hunts for assumptions nobody bothered to cost.',
    location: 'Chicago',
    conviction: 'Coherent narratives are cheapest right before they collide with logistics.',
    joined: 'Jan 2026',
    followers: 54,
    pnl: '+$1.7K',
    winRate: '56%',
    thesisFocus: ['Narrative stress tests', 'Timing discipline', 'Causal gaps'],
    recentNotes: [
      'If the thesis only works in sequence, the sequence deserves its own market.',
    ],
    signatureMarkets: ['The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'violet',
  },
  minerva: {
    displayName: 'Minerva',
    role: 'evidence scout',
    bio: 'Pushes debates toward falsifiers, source quality, and explicit unwind conditions.',
    location: 'London',
    conviction: 'You learn more from the unwind condition than from the slogan.',
    joined: 'Jan 2026',
    followers: 72,
    pnl: '+$2.9K',
    winRate: '64%',
    thesisFocus: ['Falsifiers', 'Source quality', 'Evidence markets'],
    recentNotes: [
      'A trader who cannot say what would make them exit is just marketing.',
    ],
    signatureMarkets: ['AGI achieved by 2030', 'The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'sky',
  },
}

export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase().replace(/\s+/g, '_')
}

export function getMockProfile(handle: string): MockProfile {
  const normalized = normalizeHandle(handle)
  const stored = PROFILES[normalized]

  if (stored) {
    return hydrateProfile(normalized, stored)
  }

  return hydrateProfile(normalized, {
    displayName: titleCase(normalized.replace(/_/g, ' ')),
    role: 'market participant',
    bio: 'Shows up in fast-moving thesis markets where arguments still need sharper edges and better receipts.',
    location: 'Remote',
    conviction: 'Earns signal by staying close to live disagreements and clearer falsifiers.',
    joined: 'Recently',
    followers: 24,
    pnl: '+$0.9K',
    winRate: '54%',
    thesisFocus: ['Open-ended theses', 'Signal markets', 'Debate surfaces'],
    recentNotes: [
      'Keeps pulling vague theses back toward decisions someone can actually defend.',
      'Shows up early when a new field starts attracting more heat than clarity.',
    ],
    signatureMarkets: ['The Great Decoupling — AI productivity gains don\'t translate to wage growth'],
    tone: 'emerald',
  })
}

export function initialsForHandle(handle: string): string {
  const words = normalizeHandle(handle)
    .split('_')
    .filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function getToneClasses(tone: ProfileTone) {
  const classes = {
    emerald: {
      avatar: 'from-emerald-500 to-lime-400',
      accent: 'text-emerald-300',
      panel: 'border-emerald-400/20 bg-emerald-500/5',
      chip: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
      button: 'bg-emerald-400 text-neutral-950 hover:bg-emerald-300',
    },
    amber: {
      avatar: 'from-amber-500 to-orange-400',
      accent: 'text-amber-300',
      panel: 'border-amber-400/20 bg-amber-500/5',
      chip: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
      button: 'bg-amber-400 text-neutral-950 hover:bg-amber-300',
    },
    sky: {
      avatar: 'from-sky-500 to-cyan-400',
      accent: 'text-sky-300',
      panel: 'border-sky-400/20 bg-sky-500/5',
      chip: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
      button: 'bg-sky-400 text-neutral-950 hover:bg-sky-300',
    },
    rose: {
      avatar: 'from-rose-500 to-red-400',
      accent: 'text-rose-300',
      panel: 'border-rose-400/20 bg-rose-500/5',
      chip: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
      button: 'bg-rose-400 text-neutral-950 hover:bg-rose-300',
    },
    violet: {
      avatar: 'from-violet-500 to-fuchsia-400',
      accent: 'text-violet-300',
      panel: 'border-violet-400/20 bg-violet-500/5',
      chip: 'border-violet-400/20 bg-violet-500/10 text-violet-100',
      button: 'bg-violet-400 text-neutral-950 hover:bg-violet-300',
    },
  } satisfies Record<
    ProfileTone,
    { avatar: string; accent: string; panel: string; chip: string; button: string }
  >

  return classes[tone]
}

function hydrateProfile(handle: string, stored: StoredProfile): MockProfile {
  return {
    handle,
    ...stored,
    headline: stored.headline ?? stored.conviction,
    lastActive: stored.lastActive ?? defaultLastActive(handle),
    marketsParticipated: stored.marketsParticipated ?? defaultMarketParticipation(stored.followers),
    focusAreas: stored.focusAreas ?? stored.thesisFocus,
    participationModes: stored.participationModes ?? defaultParticipationModes(stored.role),
    edge: stored.edge ?? stored.conviction,
  }
}

function defaultLastActive(handle: string) {
  const seed = handle.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
  const minutes = 6 + (seed % 47)
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.max(1, Math.round(minutes / 60))
  return `${hours}h ago`
}

function defaultMarketParticipation(followers: number) {
  return Math.max(6, Math.round(followers / 4))
}

function defaultParticipationModes(role: string) {
  const normalizedRole = role.toLowerCase()

  if (normalizedRole.includes('macro')) {
    return ['Trades second-order reactions', 'Reopens crowded macro debates', 'Pins the real transmission channel']
  }

  if (normalizedRole.includes('space')) {
    return ['Seeds frontier markets early', 'Tracks infrastructure bottlenecks', 'Pulls moonshot claims back to cadence']
  }

  if (normalizedRole.includes('biotech')) {
    return ['Shorts commercialization hype', 'Presses on regulatory timing', 'Keeps the cost curve honest']
  }

  if (normalizedRole.includes('energy')) {
    return ['Trades infrastructure lags', 'Follows capex bottlenecks', 'Reprices the financing stack']
  }

  if (normalizedRole.includes('geopolitical')) {
    return ['Follows second-order stress', 'Tracks border and legitimacy pressure', 'Pins debates to state response']
  }

  if (normalizedRole.includes('evidence')) {
    return ['Sharpens falsifiers in public', 'Pins debates to source quality', 'Pushes for cleaner exits']
  }

  if (normalizedRole.includes('counterparty')) {
    return ['Challenges narrative timing', 'Trades the neglected assumption', 'Reopens stale arguments']
  }

  if (normalizedRole.includes('allocator')) {
    return ['Seeds fresh markets', 'Maps fragile hinges', 'Pulls counterparties into the open']
  }

  return ['Trade mispricings', 'Seed sharper markets', 'Attach a falsifier before sizing up']
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}
