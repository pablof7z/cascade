/**
 * Rich User Profile Page
 * Route: /profile/:npub
 */
import { useState, useEffect, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { loadStoredKeys } from './nostrKeys'
import Wallet from './components/Wallet'
import { UserAvatar } from './components/UserAvatar'
import { getUserActivity, type UserActivity } from './services/participantIndex'
import { load as loadMarketEntries } from './storage'
import type { Market } from './market'

type ProfileData = {
  displayName: string
  bio: string
}

const PROFILE_KEY = 'cascade-profile'

function loadProfile(): ProfileData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveProfile(profile: ProfileData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// Decode npub to hex pubkey
function npubToPubkey(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub)
    if (decoded.type === 'npub') {
      return decoded.data
    }
  } catch {}
  return null
}

export default function Profile() {
  const { npub } = useParams<{ npub?: string }>()
  const keys = loadStoredKeys()
  const currentUserPubkey = keys?.pubkeyHex ?? null

  // Determine whose profile we're viewing
  const viewingPubkey = npub ? npubToPubkey(npub) : currentUserPubkey
  const isOwnProfile = !npub || (viewingPubkey === currentUserPubkey)

  const [profile, setProfile] = useState<ProfileData>(() => loadProfile() ?? { displayName: '', bio: '' })
  const [editing, setEditing] = useState(() => isOwnProfile && !loadProfile())
  const [saved, setSaved] = useState(false)
  const [activity, setActivity] = useState<UserActivity | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])

  useEffect(() => {
    if (viewingPubkey) {
      setActivity(getUserActivity(viewingPubkey))
      const entries = loadMarketEntries()
      if (entries) {
        setMarkets(Object.values(entries).map(e => e.market))
      }
    }
  }, [viewingPubkey])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile.displayName.trim()) return
    saveProfile(profile)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // If no pubkey found, show error
  if (!viewingPubkey && !isOwnProfile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="bg-neutral-900 border border-neutral-800 p-6 text-center">
          <p className="text-neutral-400">Profile not found</p>
          <Link to="/" className="mt-4 inline-block text-blue-400 hover:underline">
            Return home
          </Link>
        </div>
      </div>
    )
  }

  const displayPubkey = viewingPubkey || currentUserPubkey || ''
  const createdMarkets = markets.filter(m => m.creatorPubkey === displayPubkey)
  const marketsWithPositions = activity?.marketIds
    .map(id => markets.find(m => m.slug === id))
    .filter(Boolean) as Market[] ?? []

  // Profile editing form (own profile only)
  if (isOwnProfile && editing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 p-6">
          <h1 className="text-xl font-semibold text-white mb-6">Your profile</h1>

          <label className="block">
            <span className="text-sm text-neutral-300">Display name</span>
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
              placeholder="Your name"
              className="mt-1 w-full px-4 py-3 bg-neutral-950 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block mt-4">
            <span className="text-sm text-neutral-300">Bio</span>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
              placeholder="Optional"
              rows={3}
              className="mt-1 w-full px-4 py-3 bg-neutral-950 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </label>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={!profile.displayName.trim()}
              className="flex-1 px-4 py-3 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            {loadProfile() && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-3 text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {saved && <p className="mt-4 text-sm text-green-400 text-center">Saved</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      {/* Identity Card */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <div className="flex items-start gap-4">
          <UserAvatar pubkey={displayPubkey} size="lg" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-white">
                {isOwnProfile ? (profile.displayName || 'Anonymous') : `User ${displayPubkey.slice(0, 8)}...`}
              </h1>
              {isOwnProfile && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {isOwnProfile && profile.bio && (
              <p className="mt-2 text-neutral-400">{profile.bio}</p>
            )}
            <p className="mt-2 text-xs text-neutral-500 font-mono break-all">
              {npub || (keys?.npub ?? displayPubkey)}
            </p>
            {/* NIP-05 placeholder */}
            <p className="mt-1 text-xs text-neutral-600">NIP-05: Not verified</p>
          </div>
        </div>
      </section>

      {/* Markets Created */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Markets Created</h2>
        {createdMarkets.length === 0 ? (
          <p className="text-neutral-500 text-sm">No markets created yet</p>
        ) : (
          <div className="space-y-3">
            {createdMarkets.slice(0, 5).map(market => (
              <Link
                key={market.slug}
                to={`/market/${market.slug}`}
                className="block p-3 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                <p className="text-white font-medium">{market.title}</p>
                <p className="text-xs text-neutral-400 mt-1">{market.kind === 'thesis' ? 'Thesis' : 'Market'}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trading Activity */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Trading Activity</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-neutral-800 p-4">
            <p className="text-2xl font-bold text-white">{activity?.tradeCount ?? 0}</p>
            <p className="text-xs text-neutral-400">Total Trades</p>
          </div>
          <div className="bg-neutral-800 p-4">
            <p className={`text-2xl font-bold ${(activity?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(activity?.totalPnL ?? 0) >= 0 ? '+' : ''}{activity?.totalPnL?.toFixed(0) ?? 0}
            </p>
            <p className="text-xs text-neutral-400">Total P&L (sats)</p>
          </div>
        </div>
        {marketsWithPositions.length > 0 && (
          <div>
            <p className="text-sm text-neutral-400 mb-2">Active Positions</p>
            <div className="space-y-2">
              {marketsWithPositions.slice(0, 3).map(market => (
                <Link
                  key={market.slug}
                  to={`/market/${market.slug}`}
                  className="block p-2 bg-neutral-800 rounded hover:bg-neutral-700 transition-colors text-sm text-white"
                >
                  {market.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Discussions */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Discussions</h2>
        {(activity?.discussionPostIds?.length ?? 0) === 0 ? (
          <p className="text-neutral-500 text-sm">No discussion posts yet</p>
        ) : (
          <p className="text-neutral-400 text-sm">{activity?.discussionPostIds?.length} posts</p>
        )}
      </section>

      {/* Reputation (Placeholder) */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Reputation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-800 p-4">
            <p className="text-2xl font-bold text-neutral-500">—</p>
            <p className="text-xs text-neutral-400">Accuracy %</p>
          </div>
          <div className="bg-neutral-800 p-4">
            <p className="text-2xl font-bold text-neutral-500">—</p>
            <p className="text-xs text-neutral-400">Calibration</p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-3">Reputation metrics coming soon</p>
      </section>

      {/* Wallet (own profile only) */}
      {isOwnProfile && (
        <section>
          <Wallet />
        </section>
      )}

      {/* Social (Placeholder) */}
      <section className="bg-neutral-900 border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Social</h2>
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-neutral-500">—</p>
            <p className="text-xs text-neutral-400">Following</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-neutral-500">—</p>
            <p className="text-xs text-neutral-400">Followers</p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-3">Social features coming soon</p>
      </section>
    </div>
  )
}
