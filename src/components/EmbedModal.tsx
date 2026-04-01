import { useState } from 'react'

interface EmbedModalProps {
  marketId: string
  marketTitle: string
  isOpen: boolean
  onClose: () => void
}

type Theme = 'dark' | 'light'

export default function EmbedModal({ marketId, marketTitle, isOpen, onClose }: EmbedModalProps) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cascade.bet'
  const embedUrl = `${baseUrl}/embed/market/${marketId}${theme === 'light' ? '?theme=light' : ''}`
  const iframeCode = `<iframe src="${embedUrl}" width="380" height="200" frameborder="0" style="border-radius: 12px; max-width: 100%;"></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = iframeCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Embed Market</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Market title */}
        <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
          {marketTitle}
        </p>

        {/* Theme selector */}
        <div className="mb-4">
          <label className="block text-sm text-neutral-500 mb-2">Theme</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-4">
          <label className="block text-sm text-neutral-500 mb-2">Preview</label>
          <div className={`rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-neutral-700 bg-neutral-950' : 'border-neutral-200 bg-white'} p-3`}>
            <iframe
              src={embedUrl}
              width="100%"
              height="180"
              frameBorder="0"
              style={{ borderRadius: '12px' }}
              title="Embed preview"
            />
          </div>
        </div>

        {/* Code */}
        <div className="mb-6">
          <label className="block text-sm text-neutral-500 mb-2">Embed Code</label>
          <div className="relative">
            <pre className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all">
              {iframeCode}
            </pre>
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`w-full py-3 font-medium transition-all ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy Embed Code'}
        </button>
      </div>
    </div>
  )
}
