import { useState } from 'react'
import type { Field, FieldSource, MeetingEntry, MeetingEntryKind } from './fieldTypes'
import { getActorDisplayName } from './market'
import { UserAvatar } from './components/UserAvatar'

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

// Mock pubkeys for simulated discussion participants
const MOCK_AUTHOR_PUBKEYS: Record<string, string> = {
  orion: 'mock_orion_00000000000000000000000000000000000000000000000000001',
  delta: 'mock_delta_00000000000000000000000000000000000000000000000000002',
  minerva: 'mock_minerva_000000000000000000000000000000000000000000000003',
  atlas: 'mock_atlas_00000000000000000000000000000000000000000000000000004',
  iris: 'mock_iris_000000000000000000000000000000000000000000000000000005',
  quinn: 'mock_quinn_00000000000000000000000000000000000000000000000000006',
  sable: 'mock_sable_00000000000000000000000000000000000000000000000000007',
  echo: 'mock_echo_000000000000000000000000000000000000000000000000000008',
  lyra: 'mock_lyra_000000000000000000000000000000000000000000000000000009',
  nova: 'mock_nova_000000000000000000000000000000000000000000000000000010',
  marlow: 'mock_marlow_0000000000000000000000000000000000000000000000000011',
  you: 'you', // Will be replaced with actual user pubkey
}

interface DebatePost {
  id: string
  authorPubkey: string
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

interface DiscussionProps {
  field: Field
}

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
      authorPubkey: participant?.id ?? entry.authorId,
      author: participant?.id ?? entry.authorId,
      authorLabel: participant?.name ?? 'Unknown',
      role: participant?.role ?? 'Field participant',
      headline: entry.headline,
      content: entry.body,
      kind: getFieldPostKind(entry.kind),
      position: getFieldPosition(entry.kind),
      conviction,
      timestamp: Date.now() - index * 1000 * 60 * 23,
      replyCount: entry.kind === 'decision' ? field.meeting.actions.length : entry.citations?.length ?? 0,
      target: getFieldTarget(field, entry, citedSource?.title, linkedTopic),
      displayTime: entry.at,
    }
  })

  return {
    eyebrow: 'Field arena',
    title: 'Discussion',
    description:
      'Arguments, evidence, and decisions for this field.',
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
      'Active topics in this field.',
    nodes: field.topics.map((topic) => ({
      id: topic.id,
      label: topic.title,
      eyebrow: `${topic.kind} · ${topic.status.replace('-', ' ')}`,
      detail: topic.summary,
    })),
    composeCta: 'Post to field discussion',
    composeHint: '',
    composeTitle: 'Add to field discussion',
    composePlaceholder: 'Add your argument...',
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

  const arena = buildFieldArena(props.field)

  const posts = [...draftPosts, ...arena.posts]
  const stanceLabels = arena.stanceLabels

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const content = newPost.trim()
    if (!content) return

    const draft: DebatePost = {
      id: `draft-${Date.now()}`,
      authorPubkey: MOCK_AUTHOR_PUBKEYS.you,
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
            {arena.stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-neutral-600">{stat.label}</div>
                <div className="text-white">{stat.value}</div>
              </div>
            ))}
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

      {/* Main content - single column layout */}
      <div className="space-y-8">
        {/* Posts - flat list with dividers */}
        <div>
          <h3 className="text-sm font-medium text-white mb-4">Discussion ({posts.length})</h3>

          {/* Post list - NO CARDS, just dividers */}
          <div className="divide-y divide-neutral-800">
            {posts.map((post) => (
              <article key={post.id} className="py-5 first:pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <UserAvatar pubkey={post.authorPubkey} size="sm" />
                      <span className="text-sm font-medium text-white">{getActorDisplayName(post.authorPubkey)}</span>
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
                  <span>{post.displayTime ?? formatTimeAgo(post.timestamp)}</span>
                  <span>{post.replyCount} replies</span>
                  {post.stake ? <span>{formatCurrency(post.stake)} staked</span> : null}
                  {post.priceImpact ? <span>+{formatPercent(post.priceImpact)} price</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Compose form - inline */}
        <form
          className="max-w-2xl space-y-4 border-t border-neutral-800 pt-5"
          onSubmit={handleSubmit}
        >
          <div>
            <h3 className="text-sm font-medium text-white mb-1">{arena.composeTitle}</h3>
          </div>

          <div className="flex gap-3">
            <select
              name="discussion-position"
              value={newPosition}
              onChange={(event) => setNewPosition(event.target.value as PositionType)}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm focus:outline-none focus:border-neutral-600"
            >
              <option value="long">{stanceLabels.long}</option>
              <option value="short">{stanceLabels.short}</option>
              <option value="none">{stanceLabels.none}</option>
            </select>
            <input
              name="discussion-post"
              type="text"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              placeholder={arena.composePlaceholder}
              value={newPost}
              onChange={(event) => setNewPost(event.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
