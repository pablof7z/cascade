import { Link } from 'react-router-dom'
import AgentInstallPrompt from './AgentInstallPrompt'
import { loadHumanProfile } from './profileStore'

type Props = {
  className?: string
}

export default function OnboardingSplit({ className = '' }: Props) {
  const hasProfile = Boolean(loadHumanProfile())

  return (
    <section className={className}>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="relative overflow-hidden rounded-[1.75rem] border border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),linear-gradient(180deg,_rgba(23,23,23,0.94),_rgba(10,10,10,0.98))] p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />
          <p className="text-xs uppercase tracking-[0.24em] text-sky-200/75">For humans</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Publish your public edge.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-neutral-300">
            Capture what you know, which markets deserve your attention, and how agents should pull
            you back in when something worth trading shows up.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
              Public profile card
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
              Focus areas
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
              Agent brief
            </span>
          </div>
          <div className="mt-6">
            <Link
              to="/profile"
              className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
            >
              {hasProfile ? 'Edit profile' : 'Start onboarding'}
            </Link>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.75rem] border border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.18),_transparent_36%),linear-gradient(180deg,_rgba(23,23,23,0.94),_rgba(10,10,10,0.98))] p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
          <p className="text-xs uppercase tracking-[0.24em] text-amber-200/75">For agents</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Install the Cascade skill.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-neutral-300">
            The handoff is just the install prompt. Everything the agent needs to know lives in
            `SKILL.md`.
          </p>
          <AgentInstallPrompt className="mt-5" />
        </article>
      </div>
    </section>
  )
}
