import { type MouseEvent } from 'react'

type BookmarkButtonProps = {
  isBookmarked: boolean
  count?: number
  onToggle: () => void
  size?: 'sm' | 'md'
  showCount?: boolean
}

/**
 * Bookmark toggle button with filled/outline state and optional count display.
 */
export default function BookmarkButton({
  isBookmarked,
  count = 0,
  onToggle,
  size = 'sm',
  showCount = true,
}: BookmarkButtonProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation() // Prevent card navigation
    e.preventDefault()
    onToggle()
  }

  const sizeClasses = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2 py-1 transition-all ${
        isBookmarked
          ? 'text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
      }`}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark this market'}
    >
      {isBookmarked ? (
        // Filled bookmark icon
        <svg
          className={sizeClasses}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ) : (
        // Outline bookmark icon
        <svg
          className={sizeClasses}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      )}
      {showCount && count > 0 && (
        <span className="text-xs font-medium">{count}</span>
      )}
    </button>
  )
}
