import { markdownToHtml } from '../markdown'

type Props = {
  content: string
  className?: string
}

export default function MarkdownContent({ content, className = '' }: Props) {
  return (
    <>
      <div
        className={`markdown-content ${className}`}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
      />
      <style>{`
        .markdown-content {
          color: inherit;
        }
        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3 {
          color: #ffffff;
          font-weight: 600;
          line-height: 1.2;
          margin: 1.5rem 0 0.75rem;
        }
        .markdown-content h1 {
          font-size: 1.75rem;
        }
        .markdown-content h2 {
          font-size: 1.35rem;
        }
        .markdown-content h3 {
          font-size: 1.1rem;
        }
        .markdown-content p,
        .markdown-content ul,
        .markdown-content ol,
        .markdown-content blockquote {
          margin: 0.75rem 0;
        }
        .markdown-content ul,
        .markdown-content ol {
          padding-left: 1.35rem;
        }
        .markdown-content li + li {
          margin-top: 0.35rem;
        }
        .markdown-content blockquote {
          border-left: 3px solid rgba(115, 115, 115, 0.9);
          color: #c5c5c5;
          padding-left: 1rem;
        }
        .markdown-content strong {
          color: #ffffff;
          font-weight: 600;
        }
        .markdown-content a {
          color: #86efac;
          text-decoration: underline;
          text-underline-offset: 0.18em;
        }
        .markdown-content code {
          background: rgba(38, 38, 38, 0.9);
          border-radius: 0.375rem;
          color: #f5f5f5;
          padding: 0.1rem 0.35rem;
        }
        .markdown-content pre {
          background: rgba(23, 23, 23, 0.95);
          border: 1px solid rgba(64, 64, 64, 0.9);
          border-radius: 0.75rem;
          overflow-x: auto;
          padding: 0.9rem 1rem;
        }
        .markdown-content pre code {
          background: transparent;
          padding: 0;
        }
      `}</style>
    </>
  )
}
