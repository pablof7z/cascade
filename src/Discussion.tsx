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
  void marketId
  const [filter, setFilter] = useState<FilterType>('all')
  const [newComment, setNewComment] = useState('')

  const filteredComments = mockComments.filter((comment) => {
    if (filter === 'all') return true
    return comment.position === filter
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setNewComment('')
  }

  const filterBtnClass = (f: FilterType) =>
    `px-3 py-1.5 text-sm rounded-lg transition-colors ${
      filter === f
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-lg font-semibold text-white">Discussion</h3>
        <div className="flex gap-1">
          <button type="button" className={filterBtnClass('all')} onClick={() => setFilter('all')}>
            All
          </button>
          <button type="button" className={filterBtnClass('long')} onClick={() => setFilter('long')}>
            Long Holders
          </button>
          <button type="button" className={filterBtnClass('short')} onClick={() => setFilter('short')}>
            Short Holders
          </button>
        </div>
      </div>

      {/* Compose */}
      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-y min-h-[80px]"
          placeholder="Share your analysis..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!newComment.trim()}
        >
          Post
        </button>
      </form>

      {/* Comments */}
      <div className="space-y-4">
        {filteredComments.map((comment) => (
          <div key={comment.id} className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center bg-gray-700 text-white text-sm font-medium rounded-full">
                  {comment.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium text-white">{comment.displayName}</span>
                <code className="text-xs text-gray-500">{comment.npub}</code>
              </div>
              {comment.position !== 'none' && (
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    comment.position === 'long'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {comment.position.toUpperCase()}
                  {comment.positionSize && ` ${formatCurrency(comment.positionSize)}`}
                </span>
              )}
            </div>
            {/* Content */}
            <p className="text-gray-300 mb-3">{comment.content}</p>
            {/* Footer */}
            <span className="text-xs text-gray-500">{formatTimeAgo(comment.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
