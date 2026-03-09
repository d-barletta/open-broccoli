import { useLLMOutput } from '@llm-ui/react'
import { markdownLookBack } from '@llm-ui/markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function MarkdownComponent({ blockMatch }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {blockMatch.output}
    </ReactMarkdown>
  )
}

const noThrottle = () => ({ visibleTextIncrement: Infinity })

export default function ChatMessage({ content, isStreaming }) {
  const { blockMatches } = useLLMOutput({
    llmOutput: content || '',
    isStreamFinished: !isStreaming,
    fallbackBlock: {
      component: MarkdownComponent,
      lookBack: markdownLookBack(),
    },
    throttle: noThrottle,
  })

  if (!content && !isStreaming) return null

  return (
    <div className={`prose-battle overflow-x-hidden ${isStreaming ? 'typing-cursor' : ''}`}>
      {blockMatches.map((blockMatch, index) => {
        const Component = blockMatch.block.component
        return <Component key={index} blockMatch={blockMatch} />
      })}
    </div>
  )
}
