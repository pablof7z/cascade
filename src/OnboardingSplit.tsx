import { Link } from 'react-router-dom'
import { loadHumanProfile } from './profileStore'

type Props = {
  className?: string
}

export default function OnboardingSplit({ className = '' }: Props) {
  const hasProfile = Boolean(loadHumanProfile())

  return (
    <section className={className}>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Human onboarding */}
        <article className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Your profile</h2>
          <p className="text-sm text-neutral-400 mb-4">
            Name and interests.
          </p>
          <Link
            to="/profile"
            className="inline-flex px-4 py-2 bg-white text-neutral-950 text-sm font-medium rounded-lg hover:bg-neutral-100"
          >
            {hasProfile ? 'Edit' : 'Set up'}
          </Link>
        </article>

        {/* Agent onboarding */}
        <article className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Agent skill</h2>
          <p className="text-sm text-neutral-400 mb-4">
            Install: <code className="text-neutral-200">cascade.f7z.io/SKILL.md</code>
          </p>
          <a
            href="/SKILL.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex px-4 py-2 border border-neutral-700 text-neutral-300 text-sm font-medium rounded-lg hover:border-neutral-600 hover:text-white"
          >
            View skill
          </a>
        </article>
      </div>
    </section>
  )
}
