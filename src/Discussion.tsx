import { useState } from 'react'

type PositionType = 'long' | 'short' | 'none'
type FilterType = 'all' | 'long' | 'short'

interface Comment {
  id: string
  npub: string
  displayName: string
  content: string
  timestamp: number
  position: PositionType
  positionSize?: number
}

// Mock comments data
const mockComments: Comment[] = [
  {
    id: '1',
    npub: 'npub1abc...xyz',
    displayName: 'Alice',
    content: 'The technical barriers here are consistently underestimated. Current scaling laws suggest we\'re still 5-10 years out from anything resembling AGI.',
    timestamp: Date.now() - 3600000 * 2,
    position: 'long',
    positionSize: 500,
  },
  {
    id: '2',
    npub: 'npub1def...uvw',
    displayName: 'Bob',
    content: 'Disagree with the timeline pessimism. The rate of capability gain in the last 18 months has been unprecedented. I\'m positioned short here.',
    timestamp: Date.now() - 3600000 * 5,
    position: 'short',
    positionSize: 750,
  },
  {
    id: '3',
    npub: 'npub1ghi...rst',
    displayName: 'Carol',
    content: 'Worth noting that the resolution criteria matter a lot here. "Publicly recognized by major AI labs" is doing a lot of work in this question.',
    timestamp: Date.now() - 3600000 * 12,
    position: 'long',
    positionSize: 200,
  },
  {
    id: '4',
    npub: 'npub1jkl...opq',
    displayName: 'Dave',
    content: 'I\'ve been tracking the academic literature on this. The consensus is shifting faster than most people realize.',
    timestamp: Date.now() - 3600000 * 24,
    position: 'none',
  },
  {
    id: '5',
    npub: 'npub1mno...lmn',
    displayName: 'Eve',
    content: 'My model says this is overpriced. The coordination problems alone make 2030 extremely unlikely.',
    timestamp: Date.now() - 3600000 * 48,
    position: 'short',
    positionSize: 1200,
  },
]

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

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface DiscussionProps {
  marketId?: string
}

export default function Discussion({ marketId }: DiscussionProps) {
  // marketId can be used in the future to load comments for specific markets
  void marketId
  const [filter, setFilter] = useState<FilterType>('all')
  const [newComment, setNewComment] = useState('')

  const filteredComments = mockComments.filter((comment) => {
    if (filter === 'all') return true
    return comment.position === filter
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock: would publish to Nostr
    setNewComment('')
  }

  return (
    <div className="discussion">
      <div className="discussion-header">
        <h3 className="discussion-title">Discussion</h3>
        <div className="discussion-filters">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'long' ? 'active' : ''}`}
            onClick={() => setFilter('long')}
          >
            Long Holders
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'short' ? 'active' : ''}`}
            onClick={() => setFilter('short')}
          >
            Short Holders
          </button>
        </div>
      </div>

      <form className="discussion-compose" onSubmit={handleSubmit}>
        <textarea
          className="discussion-input"
          placeholder="Share your analysis..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <button type="submit" className="primary-button" disabled={!newComment.trim()}>
          Post
        </button>
      </form>

      <div className="discussion-comments">
        {filteredComments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <div className="comment-header">
              <div className="comment-author">
                <span className="comment-avatar">
                  {comment.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="comment-name">{comment.displayName}</span>
                <span className="comment-npub">{comment.npub}</span>
              </div>
              {comment.position !== 'none' && (
                <span className={`position-badge position-${comment.position}`}>
                  {comment.position.toUpperCase()}
                  {comment.positionSize && ` ${formatCurrency(comment.positionSize)}`}
                </span>
              )}
            </div>
            <p className="comment-content">{comment.content}</p>
            <div className="comment-footer">
              <span className="comment-time">{formatTimeAgo(comment.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
