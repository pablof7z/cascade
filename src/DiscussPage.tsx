import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import { priceLong } from './market'
import MarketTabsShell from './MarketTabsShell'
import { useNostr } from './context/NostrContext'
import { fetchMarketPosts, subscribeToMarketPosts, publishMarketPost, fetchReactions, subscribeToReactions } from './services/nostrService'
import { buildThreadHierarchy, convertSingleEventToThread } from './lib/threadBuilder'

type SortOption = 'hot' | 'new' | 'top' | 'controversial'
type PostType = 'argument' | 'evidence' | 'rebuttal' | 'analysis'

export interface Reply {
  id: string
  author: string
  pubkey: string
  isAgent: boolean
  content: string
  timestamp: number
  upvotes: number
  downvotes: number
  replies: Reply[]
}

export interface DiscussionThread {
  id: string
  author: string
  pubkey: string
  isAgent: boolean
  type: PostType
  stance: 'bull' | 'bear' | 'neutral'
  title: string
  content: string
  timestamp: number
  upvotes: number
  downvotes: number
  replies: Reply[]
  evidence?: string[]
}

// Count all replies recursively
function countAllReplies(replies: Reply[]): number {
  let count = replies.length
  for (const reply of replies) {
    count += countAllReplies(reply.replies)
  }
  return count
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

function getDiscussionStats(threads: DiscussionThread[]) {
  return threads.reduce(
    (stats, thread) => {
      stats.replies += countAllReplies(thread.replies)
      if (thread.stance === 'bull') stats.bull += 1
      if (thread.stance === 'bear') stats.bear += 1
      return stats
    },
    { replies: 0, bull: 0, bear: 0 },
  )
}

// Thread preview card for the list view (Reddit-style post list)
function ThreadPreviewCard({ thread, marketId }: { thread: DiscussionThread; marketId: string }) {
  const totalReplies = countAllReplies(thread.replies)
  
  const stanceColors = {
    bull: 'text-emerald-500',
    bear: 'text-rose-500',
    neutral: 'text-neutral-500'
  }
  
  const typeLabels = {
    argument: 'ARGUMENT',
    evidence: 'EVIDENCE',
    rebuttal: 'REBUTTAL',
    analysis: 'ANALYSIS'
  }
  
  const score = thread.upvotes - thread.downvotes
  
  return (
    <Link
      to={`/market/${marketId}/discussion/${thread.id}`}
      className="block border-b border-neutral-800/50 py-4 hover:bg-neutral-900/50 transition-colors px-4 -mx-4"
    >
      <div className="flex gap-4">
        {/* Score column */}
        <div className="flex flex-col items-center text-sm min-w-[3rem]">
          <span className="text-neutral-600">▲</span>
          <span className={`font-medium ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-rose-500' : 'text-neutral-500'}`}>
            {score}
          </span>
          <span className="text-neutral-600">▼</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
            <span className={`font-medium uppercase ${stanceColors[thread.stance]}`}>
              {thread.stance}
            </span>
            <span className="text-neutral-700">•</span>
            <span className="text-neutral-500">{typeLabels[thread.type]}</span>
            <span className="text-neutral-700">•</span>
            <span className={`font-medium ${thread.isAgent ? 'text-neutral-300' : 'text-neutral-400'}`}>
              {thread.author}
              {thread.isAgent && <span className="ml-1 text-neutral-500">[agent]</span>}
            </span>
            <span className="text-neutral-700">•</span>
            <span className="text-neutral-600">{formatTimeAgo(thread.timestamp)}</span>
          </div>
          
          {/* Title */}
          <h3 className="text-white font-medium mb-2 leading-snug">{thread.title}</h3>
          
          {/* Preview - first 150 chars */}
          <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
            {thread.content.slice(0, 150)}{thread.content.length > 150 ? '...' : ''}
          </p>
          
          {/* Footer stats */}
          <div className="flex items-center gap-4 text-xs text-neutral-600 mt-3">
            <span className="flex items-center gap-1">
              💬 {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
            </span>
            {thread.evidence && thread.evidence.length > 0 && (
              <span className="flex items-center gap-1">
                📎 {thread.evidence.length} {thread.evidence.length === 1 ? 'source' : 'sources'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

interface Props {
  markets: Record<string, MarketEntry>
}

interface MarketDiscussionPanelProps {
  marketId: string
  marketTitle: string
  variant?: 'overview' | 'discussion'
  marketEventId?: string
  marketCreatorPubkey?: string
}

export function MarketDiscussionPanel({
  marketId,
  marketTitle: _marketTitle,
  variant = 'discussion',
  marketEventId,
  marketCreatorPubkey,
}: MarketDiscussionPanelProps) {
  const [sortBy, setSortBy] = useState<SortOption>('hot')
  const [showCompose, setShowCompose] = useState(false)
  const [threads, setThreads] = useState<DiscussionThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Compose form state
  const [composeTitle, setComposeTitle] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [composeStance, setComposeStance] = useState<'bull' | 'bear' | 'neutral'>('bull')
  const [composeType, setComposeType] = useState<'argument' | 'evidence' | 'rebuttal' | 'analysis'>('argument')
  const [composeSubmitting, setComposeSubmitting] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)

  const { isReady } = useNostr()

  // Fetch initial posts
  useEffect(() => {
    if (!isReady || !marketEventId) return

    let cancelled = false

    const loadPosts = async () => {
      setLoading(true)
      setError(null)
      try {
        const rawEvents = await fetchMarketPosts(marketEventId)
        if (!cancelled) {
          const built = await buildThreadHierarchy(rawEvents, marketEventId)
          setThreads(built)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load discussion')
          console.error('[DiscussPage] fetch error:', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPosts()

    return () => {
      cancelled = true
    }
  }, [marketEventId, isReady])

  // Subscribe to live post updates
  useEffect(() => {
    if (!isReady || !marketEventId) return

    const seenIds = new Set<string>()

    const subscription = subscribeToMarketPosts(marketEventId, async (newEvent) => {
      const eventId = newEvent.id ?? ''
      if (!eventId || seenIds.has(eventId)) return
      seenIds.add(eventId)

      try {
        const newThread = await convertSingleEventToThread(newEvent)
        setThreads((prev) => {
          // Avoid duplicates from overlapping initial fetch + subscription
          if (prev.some((t) => t.id === newThread.id)) return prev
          return [newThread, ...prev]
        })
      } catch (err) {
        console.error('[DiscussPage] subscription event error:', err)
      }
    })

    return () => {
      subscription.stop()
    }
  }, [marketEventId, isReady])

  // Fetch initial reaction counts once threads are loaded
  useEffect(() => {
    if (threads.length === 0) return
    const threadIds = threads.map((t) => t.id)
    fetchReactions(threadIds)
      .then((counts) => {
        setThreads((prev) =>
          prev.map((t) => {
            const c = counts.get(t.id)
            if (!c) return t
            return { ...t, upvotes: c.upvotes, downvotes: c.downvotes }
          }),
        )
      })
      .catch((err) => console.error('[DiscussPage] fetchReactions error:', err))
  }, [threads.length])

  // Subscribe to real-time reaction updates for visible threads
  useEffect(() => {
    if (!isReady || threads.length === 0) return
    const threadIds = threads.map((t) => t.id)
    let sub: ReturnType<typeof subscribeToReactions> | null = null
    try {
      sub = subscribeToReactions(threadIds, (eventId, content) => {
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== eventId) return t
            return {
              ...t,
              upvotes: content === '+' ? t.upvotes + 1 : t.upvotes,
              downvotes: content === '-' ? t.downvotes + 1 : t.downvotes,
            }
          }),
        )
      })
    } catch (err) {
      console.error('[DiscussPage] subscribeToReactions error:', err)
    }
    return () => {
      sub?.stop()
    }
  }, [isReady, threads.length])

  const sortedThreads = useMemo(() => {
    const base = [...threads]
    switch (sortBy) {
      case 'new':
        return base.sort((a, b) => b.timestamp - a.timestamp)
      case 'top':
        return base.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
      case 'controversial':
        return base.sort((a, b) => {
          const aScore = Math.min(a.upvotes, a.downvotes) / Math.max(a.upvotes, a.downvotes, 1)
          const bScore = Math.min(b.upvotes, b.downvotes) / Math.max(b.upvotes, b.downvotes, 1)
          return bScore - aScore
        })
      default:
        return base.sort((a, b) => {
          const aHot = (a.upvotes - a.downvotes) / Math.pow(((Date.now() - a.timestamp) / 3600000) + 2, 1.8)
          const bHot = (b.upvotes - b.downvotes) / Math.pow(((Date.now() - b.timestamp) / 3600000) + 2, 1.8)
          return bHot - aHot
        })
    }
  }, [threads, sortBy])

  const displayThreads = variant === 'overview' ? sortedThreads.slice(0, 3) : sortedThreads
  const discussionStats = useMemo(() => getDiscussionStats(threads), [threads])

  async function handleComposeSubmit() {
    if (!composeTitle.trim() || !composeContent.trim()) return
    if (!marketEventId || !marketCreatorPubkey) return
    setComposeSubmitting(true)
    setComposeError(null)
    try {
      await publishMarketPost(composeTitle.trim(), composeContent.trim(), composeStance, composeType, marketEventId, marketCreatorPubkey)
      setComposeTitle('')
      setComposeContent('')
      setComposeStance('bull')
      setComposeType('argument')
      setShowCompose(false)
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setComposeSubmitting(false)
    }
  }

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'hot', label: 'Hot' },
    { value: 'new', label: 'New' },
    { value: 'top', label: 'Top' },
    { value: 'controversial', label: 'Controversial' }
  ]

  return (
    <section className="pt-6">
      <div className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h2 className="text-lg font-semibold text-white">
            Discussion
          </h2>

          {variant === 'overview' ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <span>
                <span className="font-medium text-white">{threads.length}</span> threads
              </span>
              <span>
                <span className="font-medium text-white">{discussionStats.replies}</span> replies
              </span>
              <span>
                <span className="font-medium text-emerald-400">{discussionStats.bull}</span> bull
              </span>
              <span>
                <span className="font-medium text-rose-400">{discussionStats.bear}</span> bear
              </span>
              <Link
                to={`/market/${marketId}/discussion`}
                className="font-medium text-white transition-colors hover:text-neutral-300"
              >
                All threads
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {variant === 'discussion' ? (
        <div className="border-b border-neutral-800 py-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              {sortOptions.map((opt, i) => (
                <span key={opt.value} className="flex items-center">
                  {i > 0 && <span className="text-neutral-600 mx-1">·</span>}
                  <button
                    onClick={() => setSortBy(opt.value)}
                    className={`text-sm transition-colors ${
                      sortBy === opt.value
                        ? 'text-white font-medium'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowCompose(!showCompose)}
              className="text-sm text-white bg-neutral-800 hover:bg-neutral-700 px-4 py-2"
            >
              + New post
            </button>
          </div>
        </div>
      ) : (
        <div className="border-y border-neutral-800 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-neutral-400">Top live threads</div>
            <Link
              to={`/market/${marketId}/discussion`}
              className="text-sm font-medium text-white hover:text-neutral-300"
            >
              See all {threads.length} threads
            </Link>
          </div>
        </div>
      )}

      {variant === 'discussion' && showCompose ? (
        <div className="border-b border-neutral-800 py-4">
          <input
            type="text"
            placeholder="Post title..."
            value={composeTitle}
            onChange={(e) => setComposeTitle(e.target.value)}
            className="w-full bg-transparent border border-neutral-700 text-white text-sm p-3 mb-3 focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
          />
          <textarea
            placeholder="Share your analysis, evidence, or rebuttal..."
            value={composeContent}
            onChange={(e) => setComposeContent(e.target.value)}
            className="w-full bg-transparent border border-neutral-700 text-white text-sm p-3 min-h-[120px] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
          />
          {composeError && (
            <p className="mt-2 text-xs text-rose-400">{composeError}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <select
                value={composeStance}
                onChange={(e) => setComposeStance(e.target.value as 'bull' | 'bear' | 'neutral')}
                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm px-3 py-1.5"
              >
                <option value="bull">BULL</option>
                <option value="bear">BEAR</option>
                <option value="neutral">NEUTRAL</option>
              </select>
              <select
                value={composeType}
                onChange={(e) => setComposeType(e.target.value as 'argument' | 'evidence' | 'rebuttal' | 'analysis')}
                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm px-3 py-1.5"
              >
                <option value="argument">Argument</option>
                <option value="evidence">Evidence</option>
                <option value="rebuttal">Rebuttal</option>
                <option value="analysis">Analysis</option>
              </select>
            </div>
            <button
              onClick={handleComposeSubmit}
              disabled={composeSubmitting || !composeTitle.trim() || !composeContent.trim()}
              className="bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {composeSubmitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-neutral-500">
          <div className="inline-block animate-spin text-2xl mb-3">⊙</div>
          <p>Loading discussion...</p>
        </div>
      ) : error ? (
        <div className="py-6 px-4 bg-rose-900/20 border border-rose-800/50 text-rose-400">
          {error}
        </div>
      ) : displayThreads.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">
          <p className="text-white font-medium mb-1">No discussion yet</p>
          <p className="text-sm">Be the first to share your analysis or evidence.</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-800/50">
          {displayThreads.map((thread) => (
            <ThreadPreviewCard key={thread.id} thread={thread} marketId={marketId} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function DiscussPage({ markets }: Props) {
  const { slug } = useParams<{ slug: string }>()
  const entry = slug ? markets[slug] : undefined

  if (!entry || !slug) {
    return null
  }

  const market = entry.market
  const probability = priceLong(market.qLong, market.qShort, market.b)

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-8">
        <MarketTabsShell
          marketId={market.slug}
          marketTitle={market.title}
          marketDescription={market.description}
          probability={probability}
          reserve={market.reserve}
          tradeCount={market.quotes.length}
          activeTab="discussion"
        />

        <MarketDiscussionPanel
          marketId={market.slug}
          marketTitle={market.title}
          variant="discussion"
          marketEventId={market.eventId}
          marketCreatorPubkey={market.creatorPubkey}
        />
      </div>
      
      {/* Sticky betting footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-neutral-500">Current probability</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-500">{Math.round(probability * 100)}%</span>
                <span className="text-sm text-neutral-500">YES</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs text-neutral-500">Volume</div>
              <div className="text-sm text-white">${market.reserve.toFixed(0)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/market/${slug}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
            >
              Buy YES
            </Link>
            <Link
              to={`/market/${slug}`}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium"
            >
              Buy NO
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
