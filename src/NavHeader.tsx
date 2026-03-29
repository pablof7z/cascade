import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTestnet, TESTNET_LABELS } from './testnetConfig'

export default function NavHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { isTestnet, toggle } = useTestnet()
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // For now, simulate logged-in state (replace with real auth later)
  const isLoggedIn = true

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
    if (href === '/fields') {
      return path === '/fields' || path === '/dashboard/agents' || path.startsWith('/field/')
    }

    return path === href
  }

  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive(href)
        ? 'text-white bg-neutral-800'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
    }`

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to search results (implement search page later)
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Cascade
          </Link>
          {isTestnet ? (
            <button
              onClick={toggle}
              className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-amber-950 rounded-full uppercase tracking-wide hover:bg-amber-400 transition-colors cursor-pointer"
              title="Click to switch to mainnet"
            >
              {TESTNET_LABELS.shortLabel}
            </button>
          ) : (
            <button
              onClick={toggle}
              className="px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded-full uppercase tracking-wide hover:bg-green-500 transition-colors cursor-pointer"
              title="Click to switch to testnet"
            >
              Mainnet
            </button>
          )}

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/fields" className={linkClass('/fields')}>
              Fields
            </Link>
            <Link to="/" className={linkClass('/')}>
              Markets
            </Link>
            <Link to="/leaderboard" className={linkClass('/leaderboard')}>
              Leaderboard
            </Link>
            <Link to="/activity" className={linkClass('/activity')}>
              Activity
            </Link>
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
                placeholder="Search markets..."
                className="w-48 lg:w-64 px-4 py-1.5 pl-9 text-sm bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
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

          {/* Create Market Button */}
          <Link
            to="/builder"
            className="px-4 py-2 text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Create Market
          </Link>

          {/* User Menu or Join Button */}
          {isLoggedIn ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-lg transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  U
                </div>
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
                <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 z-50">
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
                    to="/settings"
                    className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Settings
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
                      setUserMenuOpen(false)
                      // Handle logout
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/join"
              className="px-4 py-2 text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
