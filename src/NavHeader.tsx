import { Link, useLocation } from 'react-router-dom'

export default function NavHeader() {
  const location = useLocation()
  const path = location.pathname

  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      path === href
        ? 'text-white bg-neutral-800'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
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
          <Link
            to="/profile"
            className="px-4 py-2 text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Start onboarding
          </Link>
        </div>
      </div>
    </header>
  )
}
