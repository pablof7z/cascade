import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
})

export function markdownToHtml(content: string): string {
  if (!content.trim()) {
    return ''
  }

  return markdown.render(content)
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) {
    return ''
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')
  const blocks = Array.from(document.body.childNodes)
    .map((node) => serializeBlock(node))
    .filter(Boolean)

  return blocks.join('\n\n').trim()
}

function serializeBlock(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownCharacters(node.textContent ?? '').trim()
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()

  switch (tag) {
    case 'p':
      return serializeInlineChildren(element).trim()
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(tag[1]))} ${serializeInlineChildren(element).trim()}`
    case 'blockquote':
      return prefixQuote(serializeBlockChildren(element))
    case 'ul':
      return serializeList(element, false)
    case 'ol':
      return serializeList(element, true)
    case 'pre': {
      const code = element.textContent?.replace(/\n$/, '') ?? ''
      return code ? `\`\`\`\n${code}\n\`\`\`` : ''
    }
    default:
      return serializeBlockChildren(element)
  }
}

function serializeBlockChildren(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .map((child) => serializeBlock(child))
    .filter(Boolean)
    .join('\n\n')
}

function serializeList(list: HTMLElement, ordered: boolean): string {
  return Array.from(list.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI')
    .map((item, index) => serializeListItem(item, index, ordered))
    .filter(Boolean)
    .join('\n')
}

function serializeListItem(item: HTMLElement, index: number, ordered: boolean): string {
  const marker = ordered ? `${index + 1}. ` : '- '
  const content = serializeBlockChildren(item)

  if (!content) {
    return marker.trimEnd()
  }

  const [firstLine, ...rest] = content.split('\n')
  const continuation = rest.map((line) => (line ? `  ${line}` : '')).join('\n')

  return continuation ? `${marker}${firstLine}\n${continuation}` : `${marker}${firstLine}`
}

function prefixQuote(content: string): string {
  if (!content) {
    return ''
  }

  return content
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')
}

function serializeInlineChildren(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .map((child) => serializeInline(child))
    .join('')
    .replace(/\u00a0/g, ' ')
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownCharacters(node.textContent ?? '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()
  const content = serializeInlineChildren(element)

  switch (tag) {
    case 'strong':
    case 'b':
      return content ? `**${content}**` : ''
    case 'em':
    case 'i':
      return content ? `*${content}*` : ''
    case 'code':
      return content ? `\`${content.replace(/`/g, '\\`')}\`` : ''
    case 'a': {
      const href = element.getAttribute('href')
      if (!href) {
        return content
      }
      return `[${content || href}](${href})`
    }
    case 'br':
      return '  \n'
    default:
      return content
  }
}

function escapeMarkdownCharacters(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/([`*_[\]])/g, '\\$1')
}
