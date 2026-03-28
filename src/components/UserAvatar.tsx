/**
 * UserAvatar Component
 * Clickable avatar that links to /profile/:npub
 */
import { Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { getActorDisplayName, CROWD_PUBKEYS } from '../market'

type UserAvatarProps = {
  pubkey: string
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-base',
}

// Generate a deterministic color from pubkey
function getAvatarColor(pubkey: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ]
  let hash = 0
  for (let i = 0; i < pubkey.length; i++) {
    hash = pubkey.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Get initials from display name
function getInitials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Convert pubkey to npub for profile URL
function pubkeyToNpub(pubkey: string): string {
  // Handle simulated crowd pubkeys
  if (pubkey.startsWith('sim_')) {
    return pubkey
  }
  try {
    return nip19.npubEncode(pubkey)
  } catch {
    return pubkey
  }
}

// Check if this is a simulated actor
function isSimulatedActor(pubkey: string): boolean {
  return (
    pubkey.startsWith('sim_') ||
    pubkey === CROWD_PUBKEYS.alice ||
    pubkey === CROWD_PUBKEYS.bob ||
    pubkey === CROWD_PUBKEYS.carol
  )
}

export function UserAvatar({ pubkey, size = 'md', showName = false, className = '' }: UserAvatarProps) {
  const displayName = getActorDisplayName(pubkey)
  const initials = getInitials(displayName)
  const colorClass = getAvatarColor(pubkey)
  const sizeClass = SIZE_CLASSES[size]
  const npub = pubkeyToNpub(pubkey)
  const isSimulated = isSimulatedActor(pubkey)

  const avatar = (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-medium ${className}`}
      title={displayName}
    >
      {initials}
    </div>
  )

  const content = showName ? (
    <div className="flex items-center gap-2">
      {avatar}
      <span className="text-sm text-zinc-300">{displayName}</span>
    </div>
  ) : (
    avatar
  )

  // Don't link simulated actors to profiles
  if (isSimulated) {
    return content
  }

  return (
    <Link
      to={`/profile/${npub}`}
      className="hover:opacity-80 transition-opacity"
    >
      {content}
    </Link>
  )
}

export default UserAvatar
