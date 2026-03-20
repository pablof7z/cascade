import { Link, useLocation } from 'react-router-dom';

export function NavHeader() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Markets' },
    { path: '/build', label: 'Build Thesis' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/activity', label: 'Activity' },
    { path: '/profile', label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-xl font-bold text-white">
          Cascade
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === path
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button className="px-4 py-2 rounded-lg border border-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
          Connect
        </button>
      </div>
    </header>
  );
}
