import { useState, type FormEvent } from 'react'
import { loadStoredKeys } from './nostrKeys'
import Wallet from './components/Wallet'

type Profile = {
  displayName: string
  bio: string
}

const PROFILE_KEY = 'cascade-profile'

function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile() ?? { displayName: '', bio: '' })
  const [editing, setEditing] = useState(() => !loadProfile())
  const [saved, setSaved] = useState(false)
  const keys = loadStoredKeys()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile.displayName.trim()) return
    
    saveProfile(profile)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!editing && profile.displayName) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">{profile.displayName}</h1>
              {profile.bio && (
                <p className="mt-2 text-neutral-400">{profile.bio}</p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
            >
              Edit
            </button>
          </div>

          {keys && (
            <div className="mt-6 pt-6 border-t border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Your keys</p>
              <p className="text-sm text-neutral-400 font-mono break-all">{keys.npub}</p>
            </div>
          )}
        </div>

        {/* Wallet Section */}
        <div className="mt-6">
          <Wallet />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-white mb-6">Your profile</h1>

        <label className="block">
          <span className="text-sm text-neutral-300">Display name</span>
          <input
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
            placeholder="Your name"
            className="mt-1 w-full px-4 py-3 bg-neutral-950 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
          />
        </label>

        <label className="block mt-4">
          <span className="text-sm text-neutral-300">Bio</span>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
            placeholder="Optional"
            rows={3}
            className="mt-1 w-full px-4 py-3 bg-neutral-950 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
          />
        </label>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={!profile.displayName.trim()}
            className="flex-1 px-4 py-3 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
          {loadProfile() && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-3 text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {saved && (
          <p className="mt-4 text-sm text-green-400 text-center">Saved</p>
        )}
      </form>
    </div>
  )
}
