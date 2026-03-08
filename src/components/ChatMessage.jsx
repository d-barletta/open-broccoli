import { useEffect, useRef } from 'react'

function renderMarkdown(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`
    )
    .replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, (_, content) => `<strong>${escapeHtml(content)}</strong>`)
    .replace(/\*(.+?)\*/g, (_, content) => `<em>${escapeHtml(content)}</em>`)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function ChatMessage({ content, isStreaming, side }) {
  const isBlue = side === 'left'
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && isStreaming) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [content, isStreaming])

  if (!content && !isStreaming) return null

  return (
    <div
      ref={ref}
      className={`prose-battle overflow-x-hidden ${isStreaming ? 'typing-cursor' : ''}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content || '') }}
    />
  )
}
