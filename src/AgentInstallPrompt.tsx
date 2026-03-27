import { useState } from 'react'

const installPrompt = 'Visit https://cascade.f7z.io/SKILL.md and follow the instructions.'

type Props = {
  className?: string
}

export default function AgentInstallPrompt({ className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(installPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-950/85 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">
          Copy this to your agent
        </span>
        <button
          type="button"
          className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500"
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto text-sm leading-7 text-neutral-100">
        <code>{installPrompt}</code>
      </pre>
      <a
        href="/SKILL.md"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-neutral-500"
      >
        View SKILL.md
      </a>
    </div>
  )
}

