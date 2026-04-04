import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-xl text-neutral-400 mb-8">Page Not Found</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 border border-neutral-700 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          Back to Markets
        </Link>
      </div>
    </div>
  )
}
