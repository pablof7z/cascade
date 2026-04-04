import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTestnet, TESTNET_LABELS } from './testnetConfig'
import { useNostr } from './context/NostrContext'

export default function NavHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { isTestnet, toggle } = useTestnet()
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const isDashboardRoute =
    path.startsWith('/dashboard') || path === '/hire-agents'

  const navItems = isDashboardRoute
    ? [
        { href: '/dashboard/fields', label: 'Workspace' },
        { href: '/hire-agents', label: 'Hire Agents' },
        { href: '/', label: 'Markets' },
        { href: '/activity', label: 'Activity' },
      ]
    : [
        { href: '/', label: 'Markets' },
        { href: '/leaderboard', label: 'Leaderboard' },
        { href: '/activity', label: 'Activity' },
      ]

  const primaryAction = isDashboardRoute
    ? path === '/hire-agents'
      ? { to: '/dashboard/fields', label: 'View Fields' }
      : { to: '/hire-agents', label: 'Hire Agents' }
    : { to: '/builder', label: 'Build Thesis' }

  const searchPlaceholder = isDashboardRoute
    ? 'Search fields, agents, or meetings...'
    : 'Search markets...'

  const { pubkey, isReady, reconnect, disconnect } = useNostr()
  const isLoggedIn = pubkey !== null

  const avatarInitials = pubkey ? pubkey.slice(0, 4).toUpperCase() : ''
  const abbreviatedPubkey = pubkey
    ? `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`
    : ''

  const handleConnect = async () => {
    await reconnect()
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isActive = (href: string) => {
    if (href === '/dashboard/fields') {
      return path.startsWith('/dashboard')
    }
    if (href === '/hire-agents') {
      return path === '/hire-agents'
    }
    if (href === '/') {
      return path === '/'
    }
    return path === href
  }

  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? 'text-white bg-neutral-800'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
    }`

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const destination = isDashboardRoute ? '/dashboard/fields' : '/'
      navigate(`${destination}?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Contrarian Markets
          </Link>
          {isTestnet ? (
            <button
              onClick={toggle}
              className="px-2 py-0.5 text-xs font-bold border border-amber-500 text-amber-400 uppercase tracking-wide hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              title="Click to switch to mainnet"
            >
              {TESTNET_LABELS.shortLabel}
            </button>
          ) : (
            <button
              onClick={toggle}
              className="px-2 py-0.5 text-xs font-medium border border-neutral-600 text-neutral-400 uppercase tracking-wide hover:border-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
              title="Click to switch to testnet"
            >
              Mainnet
            </button>
          )}

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden sm:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-48 lg:w-64 px-4 py-1.5 pl-9 text-sm bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Primary Action */}
          <Link
            to={primaryAction.to}
            className="px-4 py-2 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 transition-colors"
          >
            {primaryAction.label}
          </Link>

          {/* User Menu or Connect Button */}
          {!isReady ? (
            <div className="w-7 h-7 rounded-sm bg-neutral-800 animate-pulse" />
          ) : isLoggedIn ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-sm transition-colors"
              >
                <div className="w-7 h-7 rounded-sm bg-neutral-700 flex items-center justify-center text-white text-xs font-mono font-bold">
                  {avatarInitials}
                </div>
                <span className="hidden sm:block text-xs font-mono text-neutral-400">
                  {abbreviatedPubkey}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 shadow-xl py-1 z-50">
                  <Link
                    to="/dashboard/fields"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/portfolio"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Portfolio
                  </Link>
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    to="/bookmarks"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Bookmarks
                  </Link>
                  <Link
                    to="/wallet"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Wallet
                  </Link>
                  <div className="border-t border-neutral-700 my-1" />
                  <button
                    className="block w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => {
                      disconnect()
                      setUserMenuOpen(false)
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="text-xs font-medium text-white border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
