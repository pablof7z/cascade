import { Link, useLocation } from 'react-router-dom'

export default function NavHeader() {
  const location = useLocation()
  const path = location.pathname

  return (
    <header className="nav-header">
      <div className="nav-brand">
        <Link to="/" className="nav-logo">
          Cascade
        </Link>
      </div>

      <nav className="nav-links">
        <Link
          to="/"
          className={`nav-link ${path === '/' ? 'active' : ''}`}
        >
          Markets
        </Link>
        <Link
          to="/builder"
          className={`nav-link ${path === '/builder' ? 'active' : ''}`}
        >
          Build Thesis
        </Link>
        <Link
          to="/portfolio"
          className={`nav-link ${path === '/portfolio' ? 'active' : ''}`}
        >
          Portfolio
        </Link>
        <Link
          to="/leaderboard"
          className={`nav-link ${path === '/leaderboard' ? 'active' : ''}`}
        >
          Leaderboard
        </Link>
      </nav>

      <div className="nav-actions">
        <button type="button" className="ghost-button nav-connect">
          Connect
        </button>
      </div>
    </header>
  )
}
