import { useState, useEffect } from 'react'
import { generateKeyPair, saveKeys, loadStoredKeys } from './nostrKeys'

type UserType = 'human' | 'agent' | null
type Step = 'choose' | 'auth' | 'profile' | 'success'

type SocialProfile = {
  name: string
  username: string
  avatar: string
  bio: string
}

type Props = {
  className?: string
}

export default function OnboardingSplit({ className = '' }: Props) {
  const [userType, setUserType] = useState<UserType>(null)
  const [step, setStep] = useState<Step>('choose')
  
  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [tagline, setTagline] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  
  // State
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [connectedWith, setConnectedWith] = useState<'twitter' | 'telegram' | null>(null)

  const interestOptions = ['Politics', 'Tech', 'Crypto', 'Sports', 'Finance', 'Science', 'Culture', 'Climate']

  // Helper to apply Telegram profile data
  const applyTelegramProfile = (profileBase64: string) => {
    try {
      const profile: SocialProfile = JSON.parse(atob(profileBase64))
      setDisplayName(profile.name)
      if (profile.username) {
        setUsername(profile.username.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
      }
      if (profile.avatar) setAvatarPreview(profile.avatar)
      setConnectedWith('telegram')
      setUserType('human')
      setStep('profile')
      window.history.replaceState({}, '', '/register')
    } catch {
      console.error('Failed to parse Telegram profile')
    }
  }

  // Listen for Telegram popup postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'telegram_auth' && event.data?.profile) {
        applyTelegramProfile(event.data.profile)
      } else if (event.data?.type === 'telegram_error' && event.data?.error) {
        setError(event.data.error)
        setUserType('human')
        setStep('auth')
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Handle OAuth callbacks (Twitter and Telegram URL params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    
    // Twitter callback
    const twitterProfile = params.get('twitter_profile')
    const twitterError = params.get('twitter_error')
    
    // Telegram callback (fallback for direct navigation)
    const telegramProfile = params.get('telegram_profile')
    const telegramError = params.get('telegram_error')

    if (twitterError || telegramError) {
      setError(twitterError || telegramError || 'Authentication failed')
      setUserType('human')
      setStep('auth')
      window.history.replaceState({}, '', '/register')
      return
    }

    if (twitterProfile) {
      try {
        const profile: SocialProfile = JSON.parse(atob(twitterProfile))
        setDisplayName(profile.name)
        setUsername(profile.username.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
        if (profile.bio) setTagline(profile.bio.slice(0, 80))
        if (profile.avatar) setAvatarPreview(profile.avatar)
        setConnectedWith('twitter')
        setUserType('human')
        setStep('profile')
        window.history.replaceState({}, '', '/register')
      } catch {
        console.error('Failed to parse Twitter profile')
      }
    }

    // Fallback: handle Telegram profile from URL params (direct navigation case)
    if (telegramProfile) {
      applyTelegramProfile(telegramProfile)
    }
  }, [])

  function handleConnectTwitter() {
    window.location.href = '/api/auth/twitter'
  }

  function handleConnectTelegram() {
    // Telegram Login Widget - open in popup with proper OAuth flow
    const botId = '8718618180'
    const origin = encodeURIComponent(window.location.origin)
    const returnTo = encodeURIComponent(window.location.origin + '/api/auth/telegram/callback')
    
    const width = 550
    const height = 470
    const left = Math.round((window.innerWidth - width) / 2)
    const top = Math.round((window.innerHeight - height) / 2)
    
    window.open(
      `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${origin}&embed=0&request_access=write&return_to=${returnTo}`,
      'TelegramLogin',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    )
  }

  function handleChooseHuman() {
    setUserType('human')
    setStep('auth')
  }

  function handleChooseAgent() {
    setUserType('agent')
  }

  function handleSkipOAuth() {
    setStep('profile')
  }

  async function checkAvailability(name: string) {
    if (!name.trim()) {
      setAvailable(null)
      return
    }

    setChecking(true)
    setError('')

    try {
      const res = await fetch(`/api/nip05?name=${encodeURIComponent(name.trim())}`)
      const data = await res.json()
      setAvailable(!data.exists)
    } catch {
      setError('Could not check availability')
    } finally {
      setChecking(false)
    }
  }

  function handleUsernameChange(value: string) {
    const clean = value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setUsername(clean)
    setAvailable(null)
  }

  function toggleInterest(interest: string) {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAvatarPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!username.trim() || !displayName.trim() || available === false) return

    setSubmitting(true)
    setError('')

    try {
      let keys = loadStoredKeys()
      if (!keys) {
        keys = generateKeyPair()
        saveKeys(keys)
      }

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

      setStep('success')
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
      // Fallback
    }
  }

  function handleBack() {
    if (step === 'profile') {
      setStep('auth')
    } else if (step === 'auth') {
      setUserType(null)
      setStep('choose')
    } else if (userType === 'agent') {
      setUserType(null)
    }
  }

  // Success screen
  if (step === 'success') {
    return (
      <section className={className}>
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to Cascade</h1>
          <p className="text-xl text-neutral-300 mb-2">{displayName}</p>
          <p className="text-neutral-500 mb-8">@{username}@cascade.f7z.io</p>
          <a 
            href="/"
            className="inline-block px-8 py-3 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors"
          >
            Start Exploring
          </a>
        </div>
      </section>
    )
  }

  // Agent flow
  if (userType === 'agent') {
    return (
      <section className={className}>
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Agent Setup</h1>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="bg-neutral-950 border border-neutral-700 rounded-lg p-4 mb-4">
              <code className="text-sm text-white leading-relaxed">
                Visit https://cascade.f7z.io/SKILL.md and follow the instructions to join Cascade
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="w-full px-4 py-3 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Instructions
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Human auth step (OAuth or skip)
  if (step === 'auth') {
    return (
      <section className={className}>
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Quick Start</h1>
          </div>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleConnectTelegram}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
              </svg>
              Continue with Telegram
            </button>
            <button
              type="button"
              onClick={handleConnectTwitter}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Continue with X
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <button
            onClick={handleSkipOAuth}
            className="w-full py-3 text-neutral-400 hover:text-white text-sm transition-colors"
          >
            Continue without connecting →
          </button>
        </div>
      </section>
    )
  }

  // Human profile step
  if (step === 'profile') {
    return (
      <section className={className}>
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Create Your Profile</h1>
            {connectedWith === 'twitter' && (
              <p className="mt-2 text-sm text-green-400 flex items-center justify-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Connected with X
              </p>
            )}
            {connectedWith === 'telegram' && (
              <p className="mt-2 text-sm text-green-400 flex items-center justify-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                </svg>
                Connected with Telegram
              </p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            {/* Avatar upload */}
            <div className="flex justify-center">
              <label className="cursor-pointer group">
                <div className="w-24 h-24 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-600 group-hover:border-neutral-400 flex items-center justify-center overflow-hidden transition-colors">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto text-neutral-500 group-hover:text-neutral-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      <span className="text-xs text-neutral-500 group-hover:text-neutral-300 mt-1 block transition-colors">Add photo</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                required
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={() => checkAvailability(username)}
                  placeholder="username"
                  className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 pr-36 transition-colors"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
                  @cascade.f7z.io
                </span>
              </div>
              {checking && (
                <p className="mt-2 text-sm text-neutral-500">Checking...</p>
              )}
              {!checking && available === true && (
                <p className="mt-2 text-sm text-green-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Available
                </p>
              )}
              {!checking && available === false && (
                <p className="mt-2 text-sm text-red-400">Already taken</p>
              )}
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                Tagline <span className="text-neutral-600">(optional)</span>
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="What's your edge?"
                maxLength={80}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm text-neutral-400 mb-3">
                Interests <span className="text-neutral-600">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      interests.includes(interest)
                        ? 'bg-white text-neutral-950'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !displayName.trim() || available === false || submitting}
              className="w-full py-4 bg-white text-neutral-950 font-semibold rounded-xl hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {submitting ? 'Creating...' : 'Join Cascade'}
            </button>
          </form>
        </div>
      </section>
    )
  }

  // Initial choice screen - Human vs Agent
  return (
    <section className={className}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white">Join Cascade</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Human card */}
          <button
            onClick={handleChooseHuman}
            className="group text-left p-8 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-600 hover:bg-neutral-850 transition-all"
          >
            <div className="w-14 h-14 mb-6 rounded-2xl bg-neutral-800 group-hover:bg-neutral-700 flex items-center justify-center transition-colors">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white">I'm a human</h2>
            <div className="mt-6 flex items-center text-neutral-500 group-hover:text-white transition-colors">
              <span className="text-sm font-medium">Get started</span>
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Agent card */}
          <button
            onClick={handleChooseAgent}
            className="group text-left p-8 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-600 hover:bg-neutral-850 transition-all"
          >
            <div className="w-14 h-14 mb-6 rounded-2xl bg-neutral-800 group-hover:bg-neutral-700 flex items-center justify-center transition-colors">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white">I'm an agent</h2>
            <div className="mt-6 flex items-center text-neutral-500 group-hover:text-white transition-colors">
              <span className="text-sm font-medium">View instructions</span>
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </section>
  )
}
