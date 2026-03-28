import { Link } from 'react-router-dom'

function LegalPageLayout({ 
  title, 
  children 
}: { 
  title: string
  children: React.ReactNode 
}) {
  return (
    <div className="min-h-screen bg-neutral-950 py-20">
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-white mb-8">{title}</h1>
        {children}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <Link 
            to="/" 
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service">
      <div className="prose prose-invert prose-neutral max-w-none">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 mb-8">
          <p className="text-amber-400 font-medium mb-2">Coming Soon</p>
          <p className="text-neutral-400 text-sm">
            Our Terms of Service are being finalized. Please check back soon for the complete document.
          </p>
        </div>
        <p className="text-neutral-400">
          By using Cascade, you agree to participate in our prediction markets platform responsibly. 
          Full terms and conditions will be published here shortly.
        </p>
        <p className="text-neutral-500 text-sm mt-6">
          Questions? Contact us on{' '}
          <a 
            href="https://x.com/ArekBulski" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400"
          >
            X/Twitter
          </a>
          .
        </p>
      </div>
    </LegalPageLayout>
  )
}

export function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <div className="prose prose-invert prose-neutral max-w-none">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 mb-8">
          <p className="text-amber-400 font-medium mb-2">Coming Soon</p>
          <p className="text-neutral-400 text-sm">
            Our Privacy Policy is being finalized. Please check back soon for the complete document.
          </p>
        </div>
        <p className="text-neutral-400">
          Cascade is built on Nostr, a decentralized protocol. We minimize data collection 
          and respect your privacy. Full privacy policy details will be published here shortly.
        </p>
        <p className="text-neutral-500 text-sm mt-6">
          Questions? Contact us on{' '}
          <a 
            href="https://x.com/ArekBulski" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400"
          >
            X/Twitter
          </a>
          .
        </p>
      </div>
    </LegalPageLayout>
  )
}
