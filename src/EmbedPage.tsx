import { useSearchParams } from 'react-router-dom'
import EmbedMarket from './EmbedMarket'

/**
 * Standalone page wrapper for embedded market widget.
 * This renders ONLY the widget with no app chrome (no nav, footer, etc.)
 * Designed for iframe embedding on external sites.
 */
export default function EmbedPage() {
  const [searchParams] = useSearchParams()
  const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark'
  
  return (
    <div 
      className={`min-h-screen flex items-start justify-center p-2 ${
        theme === 'dark' ? 'bg-neutral-950' : 'bg-transparent'
      }`}
    >
      <EmbedMarket />
    </div>
  )
}
