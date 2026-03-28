import { useState } from 'react'

const instruction = 'Tell your agent: "Visit https://cascade.f7z.io/SKILL.md and follow the instructions to join Cascade"'

export default function AgentInstallPrompt({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(instruction)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-lg p-4 ${className}`}>
      <code className="text-sm text-white break-all">{instruction}</code>
      <button
        onClick={handleCopy}
        className="mt-3 w-full px-3 py-2 text-sm border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
