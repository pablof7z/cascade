import { Link } from 'react-router-dom'
import { getMockProfile, getToneClasses, initialsForHandle } from '../mockProfiles'

type Props = {
  handle: string
  className?: string
  compact?: boolean
  showAvatar?: boolean
  stopPropagation?: boolean
}

export default function MockProfileLink({
  handle,
  className = '',
  compact = false,
  showAvatar = true,
  stopPropagation = false,
}: Props) {
  const profile = getMockProfile(handle)
  const tone = getToneClasses(profile.tone)
  const avatarSize = compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  const textSize = compact ? 'text-xs' : 'text-sm'

  return (
    <Link
      to={`/u/${profile.handle}`}
      title={profile.displayName}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation()
        }
      }}
      className={`inline-flex items-center gap-2 transition-colors hover:text-white ${textSize} ${className}`}
    >
      {showAvatar ? (
        <span
          className={`inline-flex ${avatarSize} items-center justify-center rounded-full bg-gradient-to-br ${tone.avatar} font-semibold text-white`}
          aria-hidden="true"
        >
          {initialsForHandle(profile.handle)}
        </span>
      ) : null}
      <span className="font-medium text-inherit">@{profile.handle}</span>
    </Link>
  )
}
