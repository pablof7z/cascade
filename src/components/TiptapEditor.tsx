import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { htmlToMarkdown, markdownToHtml } from '../markdown'

type TiptapEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function TiptapEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  className = '',
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[280px] py-6 text-white prose-editor',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(htmlToMarkdown(nextEditor.getHTML()))
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const currentValue = htmlToMarkdown(editor.getHTML())

    if (currentValue !== value) {
      editor.commands.setContent(markdownToHtml(value), { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div className={`tiptap-editor ${className}`}>
      {editor ? (
        <div className="mb-4 flex items-center gap-0.5">
          <ToolbarButton
            active={editor.isActive('bold')}
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <IconBold />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <IconItalic />
          </ToolbarButton>
          <div className="mx-1.5 h-4 w-px bg-neutral-700" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <IconH2 />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <IconH3 />
          </ToolbarButton>
          <div className="mx-1.5 h-4 w-px bg-neutral-700" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            title="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <IconList />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('blockquote')}
            title="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <IconQuote />
          </ToolbarButton>
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #525252;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap-editor .ProseMirror {
          line-height: 1.8;
          font-size: 1.0625rem;
        }
        .tiptap-editor .ProseMirror h2 {
          font-size: 1.375rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.5rem;
          color: #fff;
          letter-spacing: -0.01em;
        }
        .tiptap-editor .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.375rem;
          color: #fff;
        }
        .tiptap-editor .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .tiptap-editor .ProseMirror li {
          margin: 0.25rem 0;
        }
        .tiptap-editor .ProseMirror blockquote {
          border-left: 2px solid #404040;
          padding-left: 1.25rem;
          margin: 1rem 0;
          color: #a3a3a3;
          font-style: italic;
        }
        .tiptap-editor .ProseMirror p {
          margin: 0.625rem 0;
        }
        .tiptap-editor .ProseMirror strong {
          color: #fff;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? 'text-white bg-neutral-700'
          : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

function IconBold() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h8a4 4 0 0 1 0 8H6V4zm0 8h9a4 4 0 0 1 0 8H6v-8z" />
    </svg>
  )
}

function IconItalic() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4h4l-4 16H6l4-16zm4 0h4v2h-4V4zM6 18h4v2H6v-2z" />
    </svg>
  )
}

function IconH2() {
  return (
    <svg width="16" height="14" viewBox="0 0 28 24" fill="currentColor">
      <path d="M3 4v7h7V4h2v16h-2v-7H3v7H1V4h2zm12 10c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.2-.53 2.27-1.36 3H27v2h-8v-1.5l3.5-3.14A2 2 0 0 0 23 12a2 2 0 0 0-2 2h-2z" />
    </svg>
  )
}

function IconH3() {
  return (
    <svg width="16" height="14" viewBox="0 0 28 24" fill="currentColor">
      <path d="M3 4v7h7V4h2v16h-2v-7H3v7H1V4h2zm11 4h6a2 2 0 0 1 2 2 2 2 0 0 1-1.5 1.94A2.5 2.5 0 0 1 22 14.5 2.5 2.5 0 0 1 19.5 17H14v-2h5.5a.5.5 0 0 0 .5-.5.5.5 0 0 0-.5-.5H14v-2h5a1 1 0 0 0 1-1 1 1 0 0 0-1-1h-5V8z" />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
    </svg>
  )
}

function IconQuote() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  )
}
