import { Link, useLocation } from 'react-router-dom'

export default function NavHeader() {
  const location = useLocation()
  const path = location.pathname

  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      path === href
        ? 'text-white bg-gray-800'
        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Cascade
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className={linkClass('/')}>
              Markets
            </Link>
            <Link to="/builder" className={linkClass('/builder')}>
              Build Thesis
            </Link>
            <Link to="/portfolio" className={linkClass('/portfolio')}>
              Portfolio
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
          <Link to="/profile" className={linkClass('/profile')}>
            Profile
          </Link>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  )
}
