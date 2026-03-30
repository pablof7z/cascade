import { useState } from 'react'
import type { Field, FieldSource, MeetingEntry, MeetingEntryKind } from './fieldTypes'
import type { MarketKind, ThesisSignal } from './market'
import { sampleTheses } from './marketCatalog'
import MockProfileLink from './components/MockProfileLink'

type PositionType = 'long' | 'short' | 'none'
type PostKind = 'claim' | 'rebuttal' | 'evidence' | 'catalyst'
// FilterType removed - simplified UI
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
  authorLabel?: string
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
  displayTime?: string
}

interface DiscussionStat {
  label: string
  value: string
}

interface ArenaData {
  eyebrow: string
  title: string
  description: string
  stats: DiscussionStat[]
  cards: ArenaCard[]
  nodesTitle: string
  nodesDescription: string
  nodes: ArenaNode[]
  composeCta: string
  composeHint: string
  composeTitle: string
  composePlaceholder: string
  stanceLabels: Record<PositionType, string>
  defaultTarget: string
  posts: DebatePost[]
}

interface MarketDiscussionProps {
  scope?: 'market'
  marketTitle: string
  marketKind: MarketKind
  consensus: number
  reserve: number
  tradeCount: number
  thesisSignals?: ThesisSignal[]
}

interface FieldDiscussionProps {
  scope: 'field'
  field: Field
}

type DiscussionProps = MarketDiscussionProps | FieldDiscussionProps

// Removed filter tabs - overly complex for the UI

// kindOptions removed - simplified UI

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

const fieldAttentionLabels: Record<Field['attention'], string> = {
  steady: 'Steady',
  review: 'Review',
  'needs-input': 'Needs input',
}

const fieldDisagreementLabels: Record<Field['disagreement'], string> = {
  contained: 'Contained',
  rising: 'Rising',
  high: 'High',
}

function getTopicTokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3)
}

function buildThesisArena(
  marketTitle: string,
  thesisSignals: ThesisSignal[],
  consensus: number,
  reserve: number,
  tradeCount: number,
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
    stats: [
      { label: 'Consensus', value: formatPercent(consensus) },
      { label: 'Reserve', value: formatCurrency(reserve) },
      { label: 'Trades', value: `${tradeCount}` },
    ],
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
    composeTitle: 'Add to discussion',
    composePlaceholder: 'Share your argument...',
    stanceLabels: { long: 'LONG', short: 'SHORT', none: 'NEUTRAL' },
    defaultTarget: 'Core thesis',
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

function buildModuleArena(
  marketTitle: string,
  consensus: number,
  reserve: number,
  tradeCount: number,
): ArenaData {
  const linkedTheses = sampleTheses
    .filter((thesis) => thesis.thesis?.signals.some((signal) => signal.moduleTitle === marketTitle))
    .map((thesis, index) => ({
      id: `${thesis.title}-${index}`,
      label: thesis.title,
      eyebrow: 'Thesis exposed to this module',
      detail: thesis.thesis?.argument ?? thesis.description,
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
    stats: [
      { label: 'Consensus', value: formatPercent(consensus) },
      { label: 'Reserve', value: formatCurrency(reserve) },
      { label: 'Trades', value: `${tradeCount}` },
    ],
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
    composeTitle: 'Add to discussion',
    composePlaceholder: 'Share your argument...',
    stanceLabels: { long: 'YES', short: 'NO', none: 'NEUTRAL' },
    defaultTarget: 'Core module',
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

function getFieldParticipant(field: Field, participantId: string) {
  if (participantId === field.owner.id) return field.owner
  return field.council.find((agent) => agent.id === participantId)
}

function getFieldPostKind(kind: MeetingEntryKind): PostKind {
  if (kind === 'counterargument') return 'rebuttal'
  if (kind === 'evidence') return 'evidence'
  if (kind === 'decision') return 'catalyst'
  return 'claim'
}

function getFieldPosition(kind: MeetingEntryKind): PositionType {
  if (kind === 'counterargument') return 'short'
  if (kind === 'argument') return 'long'
  return 'none'
}

function getFallbackFieldTopic(field: Field, entry: MeetingEntry, citedSource?: FieldSource) {
  const entryText = [
    entry.headline,
    entry.body,
    citedSource?.title,
    ...(entry.citations?.map((citation) => citation.note) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let bestTopic = field.topics[0]
  let bestScore = 0

  for (const topic of field.topics) {
    const score = getTopicTokens(`${topic.title} ${topic.summary}`).reduce((total, token) => {
      return entryText.includes(token) ? total + token.length : total
    }, 0)

    if (score > bestScore) {
      bestTopic = topic
      bestScore = score
    }
  }

  return bestTopic
}

function getFieldTopic(field: Field, entry: MeetingEntry, citedSource?: FieldSource) {
  if (entry.topicId) {
    const linkedTopic = field.topics.find((topic) => topic.id === entry.topicId)
    if (linkedTopic) return linkedTopic
  }

  return getFallbackFieldTopic(field, entry, citedSource)
}

function getFieldTarget(
  field: Field,
  entry: MeetingEntry,
  citedSourceTitle?: string,
  linkedTopic?: Field['topics'][number],
) {
  if (entry.kind === 'evidence') return citedSourceTitle ?? linkedTopic?.title ?? 'Source library'
  if (entry.kind === 'decision') return 'Action queue'
  return linkedTopic?.title ?? field.topics[0]?.title ?? 'Field framing'
}

function buildFieldArena(field: Field): ArenaData {
  const latestCounterargument =
    [...field.meeting.entries].reverse().find((entry) => entry.kind === 'counterargument')?.body ??
    field.meeting.tensions[0] ??
    field.recentUpdate
  const sourceById = new Map(field.sourceLibrary.map((source) => [source.id, source]))
  const posts = [...field.meeting.entries].reverse().map((entry, index) => {
    const participant = getFieldParticipant(field, entry.authorId)
    const citedSource = entry.citations?.[0]
      ? sourceById.get(entry.citations[0].sourceId)
      : undefined
    const linkedTopic = getFieldTopic(field, entry, citedSource)
    const conviction: Conviction =
      entry.kind === 'decision' || entry.kind === 'counterargument'
        ? 'High'
        : entry.kind === 'evidence'
          ? 'Building'
          : 'Fresh'

    return {
      id: entry.id,
      author: participant?.id ?? entry.authorId,
      authorLabel: participant?.name ?? 'Unknown',
      role: participant?.role ?? 'Field participant',
      headline: entry.headline,
      content: entry.body,
      kind: getFieldPostKind(entry.kind),
      position: getFieldPosition(entry.kind),
      conviction,
      timestamp: Date.now() - index * 1000 * 60 * 23,
      replyCount:
        entry.kind === 'decision' ? field.meeting.actions.length : entry.citations?.length ?? 0,
      target: getFieldTarget(field, entry, citedSource?.title, linkedTopic),
      displayTime: entry.at,
    }
  })

  return {
    eyebrow: 'Field arena',
    title: 'Keep the field conversation attached to the work',
    description:
      'This thread is for field-level arguments, source pressure, and staffing decisions. The discussion should stay attached to the field itself, not scatter into adjacent views.',
    stats: [
      { label: 'Attention', value: fieldAttentionLabels[field.attention] },
      { label: 'Council', value: `${field.council.length} agents` },
      { label: 'Actions', value: `${field.meeting.actions.length}` },
    ],
    cards: [
      {
        label: 'Core view',
        stance: 'long',
        summary: field.conviction,
        hook: `Owner update: ${field.recentUpdate}`,
      },
      {
        label: 'Counterpressure',
        stance: 'short',
        summary: latestCounterargument,
        hook: `Disagreement ${fieldDisagreementLabels[field.disagreement]}`,
      },
    ],
    nodesTitle: 'Open field threads',
    nodesDescription:
      'These are the questions where public argument should keep pushing the field forward.',
    nodes: field.topics.map((topic) => ({
      id: topic.id,
      label: topic.title,
      eyebrow: `${topic.kind} · ${topic.status.replace('-', ' ')}`,
      detail: topic.summary,
    })),
    composeCta: 'Post to field discussion',
    composeHint:
      'Challenge the field framing, connect a source to a live question, or push the next action into the open.',
    composeTitle: 'Add to field discussion',
    composePlaceholder: 'Push the field framing, challenge a source, or propose the next action...',
    stanceLabels: { long: 'THESIS', short: 'COUNTER', none: 'NOTE' },
    defaultTarget: field.topics[0]?.title ?? 'Field framing',
    posts,
  }
}

function positionClass(position: PositionType) {
  if (position === 'long') return 'text-emerald-400'
  if (position === 'short') return 'text-rose-400'
  return 'text-neutral-500'
}

export default function Discussion(props: DiscussionProps) {
  // Removed filter state - simplified UI
  const [newPost, setNewPost] = useState('')
  const [newKind, setNewKind] = useState<PostKind>('claim')
  const [newPosition, setNewPosition] = useState<PositionType>('long')
  const [draftPosts, setDraftPosts] = useState<DebatePost[]>([])

  const arena =
    props.scope === 'field'
      ? buildFieldArena(props.field)
      : props.marketKind === 'thesis'
        ? buildThesisArena(
            props.marketTitle,
            props.thesisSignals ?? [],
            props.consensus,
            props.reserve,
            props.tradeCount,
          )
        : buildModuleArena(
            props.marketTitle,
            props.consensus,
            props.reserve,
            props.tradeCount,
          )

  const posts = [...draftPosts, ...arena.posts]
  const stanceLabels = arena.stanceLabels

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
      target: arena.defaultTarget,
    }

    setDraftPosts((current) => [draft, ...current])
    setNewPost('')
    setNewKind('claim')
    setNewPosition('long')
  }

  return (
    <section className="border-t border-neutral-800 pt-8">
      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 text-xs uppercase tracking-wider text-neutral-600">
              {arena.eyebrow}
            </div>
            <h2 className="mb-2 text-lg font-medium text-white">{arena.title}</h2>
            <p className="text-sm text-neutral-500">{arena.description}</p>
          </div>
          <div className="flex gap-6 text-sm">
            {arena.stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-neutral-600">{stat.label}</div>
                <div className="text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {arena.cards.map((card) => (
            <div key={card.label}>
              <div className="mb-2 flex items-center gap-2">
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

      <div className="space-y-8">
        <div>
          <h3 className="mb-4 text-sm font-medium text-white">Discussion ({posts.length})</h3>

          <div className="divide-y divide-neutral-800">
            {posts.map((post) => (
              <article key={post.id} className="py-5 first:pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {post.authorLabel ? (
                        <span className="text-white">{post.authorLabel}</span>
                      ) : (
                        <MockProfileLink
                          handle={post.author}
                          className="text-white hover:text-white"
                          compact
                          stopPropagation
                        />
                      )}
                      <span className="text-xs text-neutral-600">{post.role}</span>
                      <span className={`text-xs ${positionClass(post.position)}`}>
                        {stanceLabels[post.position]}
                      </span>
                      <span className="text-xs text-neutral-700">{post.kind}</span>
                    </div>
                    <h3 className="mb-1 text-white">{post.headline}</h3>
                    <p className="text-sm text-neutral-500">{post.content}</p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <div className="text-xs text-neutral-600">{post.target}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                  <span>{post.displayTime ?? formatTimeAgo(post.timestamp)}</span>
                  <span>{post.replyCount} replies</span>
                  {post.stake ? <span>{formatCurrency(post.stake)} staked</span> : null}
                  {post.priceImpact ? <span>+{formatPercent(post.priceImpact)} price</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <form className="max-w-2xl space-y-4 border-t border-neutral-800 pt-5" onSubmit={handleSubmit}>
          <div>
            <h3 className="mb-1 text-sm font-medium text-white">{arena.composeTitle}</h3>
          </div>

          <div className="flex gap-3">
            <select
              name="discussion-position"
              value={newPosition}
              onChange={(event) => setNewPosition(event.target.value as PositionType)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
            >
              <option value="long">{stanceLabels.long}</option>
              <option value="short">{stanceLabels.short}</option>
              <option value="none">{stanceLabels.none}</option>
            </select>
            <input
              name="discussion-post"
              type="text"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
              placeholder={arena.composePlaceholder}
              value={newPost}
              onChange={(event) => setNewPost(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!newPost.trim()}
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
