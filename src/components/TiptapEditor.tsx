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
        class: 'focus:outline-none min-h-[200px] px-0 py-4 text-white',
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
        <div className="mb-2 flex flex-wrap gap-1 border-b border-neutral-800 pb-2">
          <ToolbarButton
            active={editor.isActive('bold')}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            label="H2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            label="H3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            label="List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            active={editor.isActive('blockquote')}
            label="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #6b7280;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap-editor .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .tiptap-editor .ProseMirror h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .tiptap-editor .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid #525252;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #a3a3a3;
        }
        .tiptap-editor .ProseMirror p {
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  )
}

function ToolbarButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-neutral-700 text-white'
          : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}
