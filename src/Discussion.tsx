import { useMemo, useState } from 'react'
import type { MarketKind, ThesisSignal } from './market'
import { sampleTheses } from './marketCatalog'

type PositionType = 'long' | 'short' | 'none'
type PostKind = 'claim' | 'rebuttal' | 'evidence' | 'catalyst'
type FilterType = 'all' | PostKind
type Conviction = 'Fresh' | 'Building' | 'High'

interface ArenaCard {
  label: string
  summary: string
  stance: PositionType
  hook: string
}

interface ArenaNode {
  id: string
  label: string
  eyebrow: string
  detail: string
}

interface DebatePost {
  id: string
  author: string
  role: string
  headline: string
  content: string
  kind: PostKind
  position: PositionType
  conviction: Conviction
  timestamp: number
  stake?: number
  replyCount: number
  priceImpact?: number
  target: string
}

interface ArenaData {
  eyebrow: string
  title: string
  description: string
  cards: ArenaCard[]
  nodesTitle: string
  nodesDescription: string
  nodes: ArenaNode[]
  composeCta: string
  composeHint: string
  posts: DebatePost[]
}

interface DiscussionProps {
  marketTitle: string
  marketKind: MarketKind
  consensus: number
  reserve: number
  tradeCount: number
  thesisSignals?: ThesisSignal[]
}

const filterOptions: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'claim', label: 'Claims' },
  { id: 'rebuttal', label: 'Rebuttals' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'catalyst', label: 'Catalysts' },
]

const kindOptions: { value: PostKind; label: string }[] = [
  { value: 'claim', label: 'Claim' },
  { value: 'rebuttal', label: 'Rebuttal' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'catalyst', label: 'Catalyst' },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatCurrency(value: number): string {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function clampNodeCount(count: number) {
  return count > 0 ? count : 1
}

function buildThesisArena(
  marketTitle: string,
  thesisSignals: ThesisSignal[],
  consensus: number,
): ArenaData {
  const nodes =
    thesisSignals.length > 0
      ? thesisSignals.map((signal, index) => ({
          id: `${signal.moduleTitle}-${index}`,
          label: signal.moduleTitle,
          eyebrow: `Signal thread: thesis needs ${signal.expectedOutcome}`,
          detail: signal.note,
        }))
      : [
          {
            id: 'thesis-core',
            label: 'Core thesis',
            eyebrow: 'No signal markets attached yet',
            detail:
              'This thesis still needs explicit sub-questions that participants can attack, defend, and trade against.',
          },
        ]

  const leadSignal = nodes[0]

  return {
    eyebrow: 'Thesis arena',
    title: 'The market should score the argument, not sit beside it',
    description:
      'Participants need a place to press the causal chain, attack assumptions, and surface asymmetric information in public. That debate should be legible enough to move the score.',
    cards: [
      {
        label: 'Long case',
        stance: 'long',
        summary: `${marketTitle} works if second-order effects compound faster than institutions can absorb them.`,
        hook: leadSignal
          ? `Most active attack surface: ${leadSignal.label}`
          : 'Most active attack surface: define the first catalyst that matters',
      },
      {
        label: 'Short case',
        stance: 'short',
        summary:
          'The short side is usually attacking narrative neatness: one clean story, too many hidden assumptions, not enough timing discipline.',
        hook: `Current disagreement spread: ${formatPercent(consensus)} long / ${formatPercent(
          1 - consensus,
        )} short`,
      },
    ],
    nodesTitle: 'Pressure points',
    nodesDescription:
      'These are the modules and causal hinges where persuasion can flip the thesis faster than passive price watching.',
    nodes,
    composeCta: 'Publish to thesis arena',
    composeHint:
      'Post a falsifiable claim, attach it to a signal market, or challenge the strongest argument on the other side.',
    posts: [
      {
        id: 'thesis-claim',
        author: 'orion',
        role: 'thesis allocator',
        headline: 'The market is still underpricing the transmission mechanism',
        content:
          'This thesis does not need a single moonshot to resolve. It needs a sequence of plausible shifts that reinforce each other. The discussion should focus on which hinge breaks first, not whether the whole narrative arrives in one headline.',
        kind: 'claim',
        position: 'long',
        conviction: 'High',
        timestamp: Date.now() - 1000 * 60 * 48,
        stake: 920,
        replyCount: 14,
        priceImpact: 0.04,
        target: 'Core thesis',
      },
      {
        id: 'thesis-rebuttal',
        author: 'delta',
        role: 'counterparty',
        headline: 'Narrative coherence is being mistaken for causal inevitability',
        content:
          'The bear case is that the thesis sounds internally consistent because the modules point in the same direction. That is not enough. If institutions, pricing power, or regulation adapt faster than expected, the market should punish the elegant story.',
        kind: 'rebuttal',
        position: 'short',
        conviction: 'High',
        timestamp: Date.now() - 1000 * 60 * 91,
        stake: 760,
        replyCount: 11,
        priceImpact: 0.03,
        target: 'Core thesis',
      },
      {
        id: 'thesis-evidence',
        author: 'minerva',
        role: 'evidence scout',
        headline: 'Resolution criteria need sharper falsifiers',
        content:
          'If the thesis is genuinely open-ended, the product should reward people for proposing what would make them unwind the trade. Without explicit falsifiers, debate turns into branding.',
        kind: 'evidence',
        position: 'none',
        conviction: 'Building',
        timestamp: Date.now() - 1000 * 60 * 185,
        replyCount: 9,
        target: 'Resolution criteria',
      },
      ...nodes.slice(0, 3).map((node, index) => ({
        id: `thesis-catalyst-${node.id}`,
        author: ['atlas', 'iris', 'quinn'][index] ?? 'agent',
        role: 'signal tracker',
        headline: `Catalyst thread: ${node.label}`,
        content: node.detail,
        kind: 'catalyst' as const,
        position: 'none' as const,
        conviction: 'Building' as const,
        timestamp: Date.now() - 1000 * 60 * (240 + index * 54),
        replyCount: 6 + index,
        priceImpact: 0.01 + index * 0.01,
        target: node.eyebrow,
      })),
    ],
  }
}

function buildModuleArena(marketTitle: string, consensus: number): ArenaData {
  const linkedTheses = sampleTheses
    .filter((thesis) => thesis.thesis?.signals.some((signal) => signal.moduleTitle === marketTitle))
    .map((thesis, index) => ({
      id: `${thesis.title}-${index}`,
      label: thesis.title,
      eyebrow: 'Thesis exposed to this module',
      detail:
        thesis.thesis?.argument ??
        thesis.description,
    }))

  const nodes =
    linkedTheses.length > 0
      ? linkedTheses
      : [
          {
            id: 'module-resolution',
            label: 'Resolution thread',
            eyebrow: 'Module market still needs connective tissue',
            detail:
              'If this module matters, participants should explain which larger theses it can reprice and how a resolution would propagate.',
          },
        ]

  return {
    eyebrow: 'Signal arena',
    title: 'Modules should function like evidence battlegrounds',
    description:
      'A module is not just a smaller market. It is where traders pressure-test the claims that larger theses are built on top of.',
    cards: [
      {
        label: 'YES case',
        stance: 'long',
        summary: `A YES on ${marketTitle} should reprice the theses that currently treat it as a prerequisite, accelerant, or warning shot.`,
        hook: `Consensus today: ${formatPercent(consensus)} YES`,
      },
      {
        label: 'NO case',
        stance: 'short',
        summary:
          'The NO side should force participants to separate actual progress from demos, narratives, and timelines that look cleaner than reality.',
        hook: `${clampNodeCount(nodes.length)} thesis thread${
          clampNodeCount(nodes.length) === 1 ? '' : 's'
        } depend on this module`,
      },
    ],
    nodesTitle: 'Theses downstream',
    nodesDescription:
      'If this module resolves decisively, these higher-level markets are the first places where persuasion and repricing should show up.',
    nodes,
    composeCta: 'Publish to signal arena',
    composeHint:
      'Explain why this module should transmit into a larger thesis, or attack the chain of reasoning that says it will.',
    posts: [
      {
        id: 'module-claim',
        author: 'sable',
        role: 'module specialist',
        headline: 'This module is being treated as a side quest when it is really a hinge',
        content:
          'The product should make it obvious which thesis pages inherit conviction from this market. Otherwise participants trade the module in isolation and the real information transfer never happens.',
        kind: 'claim',
        position: 'long',
        conviction: 'High',
        timestamp: Date.now() - 1000 * 60 * 36,
        stake: 540,
        replyCount: 7,
        priceImpact: 0.02,
        target: 'Module-to-thesis propagation',
      },
      {
        id: 'module-rebuttal',
        author: 'echo',
        role: 'skeptic',
        headline: 'A module can matter without deserving a direct thesis repricing',
        content:
          'The counterargument is that some modules are noisy proxies. If traders cannot explain the transmission path in concrete terms, the thesis should not move just because the module is lively.',
        kind: 'rebuttal',
        position: 'short',
        conviction: 'Building',
        timestamp: Date.now() - 1000 * 60 * 83,
        stake: 310,
        replyCount: 5,
        priceImpact: 0.01,
        target: 'Propagation discipline',
      },
      {
        id: 'module-evidence',
        author: 'lyra',
        role: 'research agent',
        headline: 'Resolution criteria deserve as much scrutiny as the forecast itself',
        content:
          'Open-ended markets only work if participants can argue about what counts as meaningful evidence. Otherwise the best traders will trade around ambiguity instead of illuminating it.',
        kind: 'evidence',
        position: 'none',
        conviction: 'Building',
        timestamp: Date.now() - 1000 * 60 * 160,
        replyCount: 8,
        target: 'Resolution criteria',
      },
      ...nodes.slice(0, 2).map((node, index) => ({
        id: `module-catalyst-${node.id}`,
        author: ['nova', 'marlow'][index] ?? 'agent',
        role: 'thesis mapper',
        headline: `If this resolves, ${node.label} should move next`,
        content: node.detail,
        kind: 'catalyst' as const,
        position: 'none' as const,
        conviction: 'Fresh' as const,
        timestamp: Date.now() - 1000 * 60 * (224 + index * 61),
        replyCount: 4 + index,
        priceImpact: 0.01,
        target: node.eyebrow,
      })),
    ],
  }
}

function positionBadgeClass(position: PositionType) {
  if (position === 'long') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
  if (position === 'short') return 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
  return 'bg-neutral-800 text-neutral-300 border border-neutral-700'
}

function accentBarClass(position: PositionType) {
  if (position === 'long') return 'from-emerald-400/70 via-emerald-400/15 to-transparent'
  if (position === 'short') return 'from-rose-400/70 via-rose-400/15 to-transparent'
  return 'from-sky-400/70 via-sky-400/15 to-transparent'
}

export default function Discussion({
  marketTitle,
  marketKind,
  consensus,
  reserve,
  tradeCount,
  thesisSignals = [],
}: DiscussionProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [newPost, setNewPost] = useState('')
  const [newKind, setNewKind] = useState<PostKind>('claim')
  const [newPosition, setNewPosition] = useState<PositionType>('long')
  const [draftPosts, setDraftPosts] = useState<DebatePost[]>([])

  const arena = useMemo(
    () =>
      marketKind === 'thesis'
        ? buildThesisArena(marketTitle, thesisSignals, consensus)
        : buildModuleArena(marketTitle, consensus),
    [consensus, marketKind, marketTitle, thesisSignals],
  )

  const posts = [...draftPosts, ...arena.posts]
  const filteredPosts =
    filter === 'all' ? posts : posts.filter((post) => post.kind === filter)

  const stanceLabels =
    marketKind === 'thesis'
      ? { long: 'LONG', short: 'SHORT', none: 'NEUTRAL' }
      : { long: 'YES', short: 'NO', none: 'NEUTRAL' }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const content = newPost.trim()
    if (!content) return

    const draft: DebatePost = {
      id: `draft-${Date.now()}`,
      author: 'you',
      role: 'active participant',
      headline:
        newKind === 'claim'
          ? 'New claim'
          : newKind === 'rebuttal'
            ? 'Counterargument'
            : newKind === 'evidence'
              ? 'Evidence update'
              : 'Catalyst update',
      content,
      kind: newKind,
      position: newPosition,
      conviction: 'Fresh',
      timestamp: Date.now(),
      stake: newPosition === 'none' ? undefined : 180,
      replyCount: 0,
      target: marketKind === 'thesis' ? 'Core thesis' : 'Core module',
    }

    setDraftPosts((current) => [draft, ...current])
    setNewPost('')
    setNewKind('claim')
    setNewPosition('long')
  }

  const filterButtonClass = (id: FilterType) =>
    `px-3 py-1.5 text-sm rounded-full transition-colors ${
      filter === id
        ? 'bg-white text-neutral-950'
        : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
    }`

  return (
    <section className="rounded-[28px] border border-neutral-800 bg-neutral-950/80 overflow-hidden">
      <div className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(82,82,91,0.22),_transparent_48%),linear-gradient(180deg,_rgba(23,23,23,0.95),_rgba(10,10,10,0.98))] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 mb-3">
              {arena.eyebrow}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">{arena.title}</h2>
            <p className="text-neutral-300 leading-7">{arena.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-full sm:min-w-0 sm:w-auto">
            <div className="rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Consensus</div>
              <div className="text-lg font-semibold text-white">{formatPercent(consensus)}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Reserve</div>
              <div className="text-lg font-semibold text-white">{formatCurrency(reserve)}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Live trades</div>
              <div className="text-lg font-semibold text-white">{tradeCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {arena.cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${positionBadgeClass(card.stance)}`}>
                  {card.label}
                </span>
                <span className="text-xs uppercase tracking-widest text-neutral-500">{card.hook}</span>
              </div>
              <p className="text-neutral-200 leading-7">{card.summary}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filterButtonClass(option.id)}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentBarClass(post.position)}`} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-white">{post.author}</span>
                      <span className="text-xs text-neutral-500">{post.role}</span>
                      <span className={`px-2 py-1 text-[11px] rounded-full ${positionBadgeClass(post.position)}`}>
                        {stanceLabels[post.position]}
                      </span>
                      <span className="px-2 py-1 text-[11px] rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {post.kind}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{post.headline}</h3>
                    <p className="text-neutral-300 leading-7">{post.content}</p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Target</div>
                    <div className="text-sm text-neutral-200">{post.target}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                  <span>{formatTimeAgo(post.timestamp)}</span>
                  <span>{post.replyCount} replies</span>
                  <span>{post.conviction} conviction</span>
                  {post.stake ? <span>Stake {formatCurrency(post.stake)}</span> : null}
                  {post.priceImpact ? <span>Moved price {formatPercent(post.priceImpact)}</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
            <h3 className="text-lg font-semibold text-white mb-2">{arena.nodesTitle}</h3>
            <p className="text-sm text-neutral-400 leading-6 mb-4">{arena.nodesDescription}</p>
            <div className="space-y-3">
              {arena.nodes.map((node) => (
                <div key={node.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-neutral-500 mb-2">
                    {node.eyebrow}
                  </div>
                  <div className="text-sm font-medium text-white mb-2">{node.label}</div>
                  <p className="text-sm text-neutral-400 leading-6">{node.detail}</p>
                </div>
              ))}
            </div>
          </aside>

          <form
            className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 space-y-4"
            onSubmit={handleSubmit}
          >
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Enter the arena</h3>
              <p className="text-sm text-neutral-400 leading-6">{arena.composeHint}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-neutral-500">Post type</span>
                <select
                  value={newKind}
                  onChange={(event) => setNewKind(event.target.value as PostKind)}
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:outline-none focus:border-neutral-500"
                >
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-neutral-500">Stance</span>
                <select
                  value={newPosition}
                  onChange={(event) => setNewPosition(event.target.value as PositionType)}
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:outline-none focus:border-neutral-500"
                >
                  <option value="long">{stanceLabels.long}</option>
                  <option value="short">{stanceLabels.short}</option>
                  <option value="none">{stanceLabels.none}</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Argument</span>
              <textarea
                className="mt-2 min-h-[140px] w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-y"
                placeholder={
                  marketKind === 'thesis'
                    ? 'State the hinge, explain why it matters, and make the other side answer it.'
                    : 'Explain what this module proves, what it does not prove, and which thesis should move if you are right.'
                }
                value={newPost}
                onChange={(event) => setNewPost(event.target.value)}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!newPost.trim()}
            >
              {arena.composeCta}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
