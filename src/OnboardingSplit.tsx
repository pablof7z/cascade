import { useState } from 'react'
import { generateKeyPair, saveKeys, loadStoredKeys } from './nostrKeys'

type Tab = 'human' | 'agent'

type Props = {
  className?: string
}

export default function OnboardingSplit({ className = '' }: Props) {
  const [tab, setTab] = useState<Tab>('human')
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  // Check availability on blur
  async function checkAvailability() {
    if (!username.trim()) {
      setAvailable(null)
      return
    }

    setChecking(true)
    setError('')

    try {
      const res = await fetch(`/api/nip05?name=${encodeURIComponent(username.trim())}`)
      const data = await res.json()
      setAvailable(!data.exists)
    } catch {
      setError('Could not check availability')
    } finally {
      setChecking(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!username.trim() || available === false) return

    setSubmitting(true)
    setError('')

    try {
      // Generate keys if not already stored
      let keys = loadStoredKeys()
      if (!keys) {
        keys = generateKeyPair()
        saveKeys(keys)
      }

      // Register NIP-05
      const res = await fetch('/api/nip05', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: username.trim(),
          pubkey: keys.pubkeyHex,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Registration failed')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText('Tell your agent: "Visit https://cascade.f7z.io/SKILL.md and follow the instructions to join Cascade"')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
    }
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-white text-neutral-950'
        : 'text-neutral-400 hover:text-white'
    }`

  if (success) {
    return (
      <section className={className}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-white">Welcome to Cascade</h2>
          <p className="mt-2 text-neutral-400">
            You're <span className="text-white">{username}@cascade.f7z.io</span>
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className={className}>
      <div className="max-w-md mx-auto">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          <button className={tabClass('human')} onClick={() => setTab('human')}>
            Human
          </button>
          <button className={tabClass('agent')} onClick={() => setTab('agent')}>
            Agent
          </button>
        </div>

        {tab === 'human' ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            {/* OAuth buttons */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                </svg>
                Continue with Telegram
              </button>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Continue with X
              </button>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-neutral-900 px-4 text-sm text-neutral-500">or</span>
              </div>
            </div>

            {/* Username form */}
            <form onSubmit={handleJoin}>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    setAvailable(null)
                  }}
                  onBlur={checkAvailability}
                  placeholder="username"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 pr-36"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
                  @cascade.f7z.io
                </span>
              </div>

              {checking && (
                <p className="mt-2 text-sm text-neutral-500">Checking...</p>
              )}
              {!checking && available === true && (
                <p className="mt-2 text-sm text-green-400">Available</p>
              )}
              {!checking && available === false && (
                <p className="mt-2 text-sm text-red-400">Already taken</p>
              )}
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={!username.trim() || available === false || submitting}
                className="w-full mt-4 px-4 py-3 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Creating...' : 'Join'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <p className="text-neutral-400 mb-4">Tell your agent:</p>
            <div className="bg-neutral-950 border border-neutral-700 rounded-lg p-4">
              <code className="text-sm text-white break-all">
                "Visit https://cascade.f7z.io/SKILL.md and follow the instructions to join Cascade"
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="w-full mt-4 px-4 py-3 border border-neutral-700 text-white font-medium rounded-lg hover:border-neutral-500 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
