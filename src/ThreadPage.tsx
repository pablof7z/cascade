import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import { priceLong } from './market'
import type { DiscussionThread } from './DiscussPage'
import { trackDiscussionInteraction } from './analytics'
import { useNostr } from './context/NostrContext'
import { fetchMarketPosts, publishMarketReply, publishReaction, fetchReactions, subscribeToReactions } from './services/nostrService'
import { buildThreadHierarchy } from './lib/threadBuilder'

interface Reply {
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

function VoteButtons({
  upvotes,
  downvotes,
  eventId,
  authorPubkey,
  marketId,
}: {
  upvotes: number
  downvotes: number
  eventId: string
  authorPubkey: string
  marketId: string
}) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [localUpvotes, setLocalUpvotes] = useState(upvotes)
  const [localDownvotes, setLocalDownvotes] = useState(downvotes)
  const [publishing, setPublishing] = useState(false)

  // Sync from parent when reaction counts update
  useEffect(() => { setLocalUpvotes(upvotes) }, [upvotes])
  useEffect(() => { setLocalDownvotes(downvotes) }, [downvotes])

  const score = localUpvotes - localDownvotes

  async function handleVote(direction: 'up' | 'down') {
    if (publishing) return
    // Toggle off if same vote — no NIP-25 "unreact", just UI-only toggle
    if (voted === direction) {
      setVoted(null)
      return
    }
    setVoted(direction)
    setPublishing(true)
    try {
      await publishReaction(eventId, authorPubkey, marketId, direction === 'up' ? '+' : '-')
      // Optimistic update — real count arrives via subscription
      if (direction === 'up') setLocalUpvotes((n) => n + 1)
      else setLocalDownvotes((n) => n + 1)
    } catch (err) {
      // Revert on failure
      setVoted(null)
      console.error('[VoteButtons] publishReaction failed:', err)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={(e) => { e.stopPropagation(); handleVote('up') }}
        disabled={publishing}
        className={`p-1 hover:bg-neutral-800 disabled:opacity-50 ${voted === 'up' ? 'text-emerald-500' : 'text-neutral-500 hover:text-emerald-400'}`}
      >
        ▲
      </button>
      <span className={`min-w-[2rem] text-center ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-rose-500' : 'text-neutral-500'}`}>
        {score}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); handleVote('down') }}
        disabled={publishing}
        className={`p-1 hover:bg-neutral-800 disabled:opacity-50 ${voted === 'down' ? 'text-rose-500' : 'text-neutral-500 hover:text-rose-400'}`}
      >
        ▼
      </button>
    </div>
  )
}

function ReplyThread({
  reply,
  depth = 0,
  marketId,
  rootId,
}: {
  reply: Reply
  depth?: number
  marketId: string
  rootId: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const maxDepth = 6
  const indentClass = depth < maxDepth ? 'ml-5 border-l border-neutral-800 pl-4' : ''

  async function handleReplySubmit() {
    if (!replyContent.trim()) return
    setSubmitting(true)
    setReplyError(null)
    try {
      await publishMarketReply(replyContent.trim(), reply.id, rootId, reply.author)
      setReplyContent('')
      setShowReplyBox(false)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to publish reply')
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div className={indentClass}>
      <div className="py-3">
        <div className="flex items-center gap-3 mb-2">
          <VoteButtons upvotes={reply.upvotes} downvotes={reply.downvotes} eventId={reply.id} authorPubkey={reply.pubkey} marketId={marketId} />
          <span className={`text-sm font-medium ${reply.isAgent ? 'text-emerald-400' : 'text-neutral-300'}`}>
            {reply.author}
            {reply.isAgent && <span className="ml-1 text-xs text-emerald-600">[agent]</span>}
          </span>
          <span className="text-xs text-neutral-600">{formatTimeAgo(reply.timestamp)}</span>
          {reply.replies.length > 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              [{collapsed ? '+' : '-'}]
            </button>
          )}
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{reply.content}</p>
        <div className="mt-2 flex gap-4 text-xs text-neutral-600">
          <button 
            onClick={() => setShowReplyBox(!showReplyBox)}
            className="hover:text-neutral-400"
          >
            reply
          </button>
          <button className="hover:text-neutral-400">share</button>
        </div>
        
        {showReplyBox && (
          <div className="mt-3">
            <textarea
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              className="w-full bg-transparent border border-neutral-700 text-white text-sm p-2 min-h-[80px] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
            />
            {replyError && <p className="mt-1 text-xs text-rose-400">{replyError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button 
                onClick={() => { setShowReplyBox(false); setReplyContent('') }}
                className="text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReplySubmit}
                disabled={submitting || !replyContent.trim()}
                className="text-xs bg-white text-neutral-900 font-medium px-3 py-1 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting…' : 'Reply'}
              </button>
            </div>
          </div>
        )}
      </div>
      {!collapsed && reply.replies.map(r => (
        <ReplyThread key={r.id} reply={r} depth={depth + 1} marketId={marketId} rootId={rootId} />
      ))}
    </div>
  )
}

function OriginalPost({
  thread,
  marketId,
}: {
  thread: DiscussionThread
  marketId: string
}) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  
  const stanceColors = {
    bull: 'text-emerald-500 bg-emerald-950/30',
    bear: 'text-rose-500 bg-rose-950/30',
    neutral: 'text-neutral-500 bg-neutral-800/50'
  }
  
  const typeLabels = {
    argument: 'ARGUMENT',
    evidence: 'EVIDENCE',
    rebuttal: 'REBUTTAL',
    analysis: 'ANALYSIS'
  }

  async function handleReplySubmit() {
    if (!replyContent.trim()) return
    setSubmitting(true)
    setReplyError(null)
    try {
      // Reply directly to the root post (parentId === rootId for top-level replies)
      await publishMarketReply(replyContent.trim(), thread.id, thread.id, thread.author)
      setReplyContent('')
      setShowReplyBox(false)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to publish reply')
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <article className="border-b border-neutral-800 pb-6">
      {/* Header */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <VoteButtons upvotes={thread.upvotes} downvotes={thread.downvotes} eventId={thread.id} authorPubkey={thread.pubkey} marketId={marketId} />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs font-medium uppercase px-2 py-0.5 ${stanceColors[thread.stance]}`}>
              {thread.stance}
            </span>
            <span className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5">
              {typeLabels[thread.type]}
            </span>
          </div>
          
          {/* Title */}
          <h1 className="text-xl font-bold text-white mb-4 leading-tight">{thread.title}</h1>
          
          {/* Author line */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <span className={`font-medium ${thread.isAgent ? 'text-emerald-400' : 'text-neutral-300'}`}>
              {thread.author}
              {thread.isAgent && <span className="ml-1 text-xs text-emerald-600">[agent]</span>}
            </span>
            <span className="text-neutral-700">•</span>
            <span className="text-neutral-500">{formatTimeAgo(thread.timestamp)}</span>
          </div>
          
          {/* Content */}
          <div className="text-neutral-300 leading-relaxed whitespace-pre-line mb-4">
            {thread.content}
          </div>
          
          {/* Evidence links */}
          {thread.evidence && thread.evidence.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {thread.evidence.map((e, i) => (
                <span key={i} className="text-xs text-neutral-400 bg-neutral-800 px-2 py-1">
                  {e}
                </span>
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <button 
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="hover:text-neutral-400"
            >
              💬 Reply
            </button>
            <button className="hover:text-neutral-400">🔗 Share</button>
            <button className="hover:text-neutral-400">⚑ Report</button>
          </div>
          
          {showReplyBox && (
            <div className="mt-4">
              <textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="w-full bg-transparent border border-neutral-700 text-white text-sm p-3 min-h-[100px] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
              />
              {replyError && <p className="mt-1 text-xs text-rose-400">{replyError}</p>}
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => { setShowReplyBox(false); setReplyContent('') }}
                  className="text-sm text-neutral-500 hover:text-neutral-300 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReplySubmit}
                  disabled={submitting || !replyContent.trim()}
                  className="text-sm bg-white text-neutral-900 font-medium px-4 py-2 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Posting…' : 'Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

interface Props {
  markets: Record<string, MarketEntry>
}

/** Recursively collect all event IDs from a thread (root + all nested replies). */
function collectEventIds(thread: DiscussionThread): string[] {
  const ids: string[] = [thread.id]
  function collectFromReplies(replies: Reply[]) {
    for (const r of replies) {
      ids.push(r.id)
      collectFromReplies(r.replies)
    }
  }
  collectFromReplies(thread.replies)
  return ids
}

/** Apply reaction counts map onto a thread tree (mutates a copy). */
function applyReactionCounts(
  threads: DiscussionThread[],
  counts: Map<string, { upvotes: number; downvotes: number }>,
): DiscussionThread[] {
  function applyToReplies(replies: Reply[]): Reply[] {
    return replies.map((r) => {
      const c = counts.get(r.id)
      return {
        ...r,
        upvotes: c ? c.upvotes : r.upvotes,
        downvotes: c ? c.downvotes : r.downvotes,
        replies: applyToReplies(r.replies),
      }
    })
  }
  return threads.map((t) => {
    const c = counts.get(t.id)
    return {
      ...t,
      upvotes: c ? c.upvotes : t.upvotes,
      downvotes: c ? c.downvotes : t.downvotes,
      replies: applyToReplies(t.replies),
    }
  })
}

export default function ThreadPage({ markets }: Props) {
  const { slug: marketId, threadId } = useParams<{ slug: string; threadId: string }>()
  const navigate = useNavigate()
  const { isReady } = useNostr()

  const [threads, setThreads] = useState<DiscussionThread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (marketId && threadId) {
      trackDiscussionInteraction(marketId, 'view_thread')
    }
  }, [marketId, threadId])

  useEffect(() => {
    if (!isReady || !marketId) return
    const marketEventId = marketId ? markets[marketId]?.market.eventId : undefined
    if (!marketEventId) return
    let cancelled = false

    setLoading(true)
    fetchMarketPosts(marketEventId)
      .then((events) => buildThreadHierarchy(events, marketEventId))
      .then(async (built) => {
        if (cancelled) return
        setThreads(built)
        setLoading(false)
        // Fetch initial reaction counts for all events in the thread
        const allIds = built.flatMap(collectEventIds)
        if (allIds.length === 0) return
        try {
          const counts = await fetchReactions(allIds)
          if (!cancelled) {
            setThreads((prev) => applyReactionCounts(prev, counts))
          }
        } catch (err) {
          console.error('[ThreadPage] fetchReactions error:', err)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isReady, marketId, markets])

  // Subscribe to real-time reaction updates
  useEffect(() => {
    if (!isReady || !marketId) return

    // Wait until we have threads loaded before subscribing
    if (threads.length === 0) return

    const allIds = threads.flatMap(collectEventIds)
    if (allIds.length === 0) return

    let sub: ReturnType<typeof subscribeToReactions> | null = null
    try {
      sub = subscribeToReactions(allIds, (eventId, content) => {
        setThreads((prev) => {
          const delta = new Map<string, { upvotes: number; downvotes: number }>()
          // Get current counts for this event and increment
          function findCurrent(ts: DiscussionThread[]): { upvotes: number; downvotes: number } | null {
            for (const t of ts) {
              if (t.id === eventId) return { upvotes: t.upvotes, downvotes: t.downvotes }
              function inReplies(replies: Reply[]): { upvotes: number; downvotes: number } | null {
                for (const r of replies) {
                  if (r.id === eventId) return { upvotes: r.upvotes, downvotes: r.downvotes }
                  const found = inReplies(r.replies)
                  if (found) return found
                }
                return null
              }
              const found = inReplies(t.replies)
              if (found) return found
            }
            return null
          }
          const current = findCurrent(prev) ?? { upvotes: 0, downvotes: 0 }
          delta.set(eventId, {
            upvotes: content === '+' ? current.upvotes + 1 : current.upvotes,
            downvotes: content === '-' ? current.downvotes + 1 : current.downvotes,
          })
          return applyReactionCounts(prev, delta)
        })
      })
    } catch (err) {
      console.error('[ThreadPage] subscribeToReactions error:', err)
    }

    return () => {
      sub?.stop()
    }
  }, [isReady, marketId, threads.length])

  const entry = marketId ? markets[marketId] : undefined

  if (!entry) {
    navigate('/')
    return null
  }

  const market = entry.market
  const probability = priceLong(market.qLong, market.qShort, market.b)

  const thread = threads.find((t) => t.id === threadId)

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <span className="text-neutral-500 text-sm">Loading thread…</span>
      </div>
    )
  }

  if (!thread) {
    navigate(`/market/${marketId}/discussion`)
    return null
  }
  
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 pb-32">
        {/* Breadcrumb */}
        <div className="py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Link to={`/market/${marketId}`} className="hover:text-neutral-300">
              {market.title.length > 40 ? market.title.slice(0, 40) + '...' : market.title}
            </Link>
            <span>›</span>
            <Link to={`/market/${marketId}/discussion`} className="hover:text-neutral-300">
              Discussion
            </Link>
            <span>›</span>
            <span className="text-neutral-400">Thread</span>
          </div>
        </div>
        
        {/* Original Post */}
        <div className="py-6">
          <OriginalPost thread={thread} marketId={marketId!} />
        </div>
        
        {/* Replies section */}
        <div className="border-t border-neutral-800 pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-neutral-400">
              {thread.replies.length} {thread.replies.length === 1 ? 'Reply' : 'Replies'}
            </h2>
            <select className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs px-2 py-1">
              <option>Best</option>
              <option>New</option>
              <option>Old</option>
              <option>Controversial</option>
            </select>
          </div>
          
          {/* Threaded replies */}
          <div className="space-y-1">
            {thread.replies.map(reply => (
              <ReplyThread key={reply.id} reply={reply} marketId={marketId!} rootId={thread.id} />
            ))}
          </div>
          
          {thread.replies.length === 0 && (
            <div className="py-8 text-center text-neutral-500">
              <p>No replies yet. Be the first to respond!</p>
            </div>
          )}
        </div>
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
              to={`/market/${marketId}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
            >
              Buy YES
            </Link>
            <Link
              to={`/market/${marketId}`}
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
