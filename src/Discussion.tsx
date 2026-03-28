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

function positionClass(position: PositionType) {
  if (position === 'long') return 'text-emerald-400'
  if (position === 'short') return 'text-rose-400'
  return 'text-neutral-500'
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

  return (
    <section className="border-t border-neutral-800 pt-8">
      {/* Header - no card wrapper */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
              {arena.eyebrow}
            </div>
            <h2 className="text-lg font-medium text-white mb-2">{arena.title}</h2>
            <p className="text-sm text-neutral-500">{arena.description}</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-neutral-600">Consensus</div>
              <div className="text-white">{formatPercent(consensus)}</div>
            </div>
            <div>
              <div className="text-neutral-600">Reserve</div>
              <div className="text-white">{formatCurrency(reserve)}</div>
            </div>
            <div>
              <div className="text-neutral-600">Trades</div>
              <div className="text-white">{tradeCount}</div>
            </div>
          </div>
        </div>

        {/* Case summaries - flat, no cards */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {arena.cards.map((card) => (
            <div key={card.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-medium ${positionClass(card.stance)}`}>
                  {card.label}
                </span>
                <span className="text-xs text-neutral-600">{card.hook}</span>
              </div>
              <p className="text-sm text-neutral-400">{card.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
        {/* Posts - flat list with dividers */}
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === option.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-600 hover:text-white'
                }`}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Post list - NO CARDS, just dividers */}
          <div className="divide-y divide-neutral-800">
            {filteredPosts.map((post) => (
              <article key={post.id} className="py-5 first:pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{post.author}</span>
                      <span className="text-xs text-neutral-600">{post.role}</span>
                      <span className={`text-xs ${positionClass(post.position)}`}>
                        {stanceLabels[post.position]}
                      </span>
                      <span className="text-xs text-neutral-700">{post.kind}</span>
                    </div>
                    <h3 className="text-white mb-1">{post.headline}</h3>
                    <p className="text-sm text-neutral-500">{post.content}</p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <div className="text-xs text-neutral-600">{post.target}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                  <span>{formatTimeAgo(post.timestamp)}</span>
                  <span>{post.replyCount} replies</span>
                  {post.stake ? <span>{formatCurrency(post.stake)} staked</span> : null}
                  {post.priceImpact ? <span>+{formatPercent(post.priceImpact)} price</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pressure points - flat list */}
          <aside>
            <h3 className="text-sm font-medium text-white mb-1">{arena.nodesTitle}</h3>
            <p className="text-xs text-neutral-600 mb-4">{arena.nodesDescription}</p>
            <div className="divide-y divide-neutral-800">
              {arena.nodes.map((node) => (
                <div key={node.id} className="py-3 first:pt-0">
                  <div className="text-xs text-neutral-600 mb-1">{node.eyebrow}</div>
                  <div className="text-sm font-medium text-white mb-1">{node.label}</div>
                  <p className="text-xs text-neutral-500">{node.detail}</p>
                </div>
              ))}
            </div>
          </aside>

          {/* Compose - THE ONLY CARD in discussion */}
          <form
            className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4"
            onSubmit={handleSubmit}
          >
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Enter the arena</h3>
              <p className="text-xs text-neutral-600">{arena.composeHint}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-neutral-600">Type</span>
                <select
                  value={newKind}
                  onChange={(event) => setNewKind(event.target.value as PostKind)}
                  className="mt-1 w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                >
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-neutral-600">Stance</span>
                <select
                  value={newPosition}
                  onChange={(event) => setNewPosition(event.target.value as PositionType)}
                  className="mt-1 w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                >
                  <option value="long">{stanceLabels.long}</option>
                  <option value="short">{stanceLabels.short}</option>
                  <option value="none">{stanceLabels.none}</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-neutral-600">Argument</span>
              <textarea
                className="mt-1 min-h-[100px] w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-y"
                placeholder={
                  marketKind === 'thesis'
                    ? 'State the hinge, explain why it matters...'
                    : 'Explain what this module proves...'
                }
                value={newPost}
                onChange={(event) => setNewPost(event.target.value)}
              />
            </label>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-white text-neutral-950 text-sm font-medium rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
