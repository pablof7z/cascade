import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loadStoredKeys } from '../nostrKeys';

export function NavHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  function handleConnect() {
    const keys = loadStoredKeys();
    if (keys) {
      navigate('/profile');
    } else {
      navigate('/join');
    }
  }
  
  const navItems = [
    { path: '/', label: 'Markets' },
    { path: '/build', label: 'Build Thesis' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/activity', label: 'Activity' },
    { path: '/profile', label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-xl font-bold text-white">
          Contrarian Markets
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === path
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleConnect}
          className="px-4 py-2 border border-neutral-700 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          Connect
        </button>
      </div>
    </header>
  );
}
