const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export async function fetchModels(apiKey) {
  const response = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Failed to fetch models: ${response.status}`)
  }

  const data = await response.json()
  return data.data || []
}

export async function streamChatCompletion({ apiKey, model, messages, onChunk, onDone, onError }) {
  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'LLM Battle Arena',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `API error: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onChunk(delta, fullContent)
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    onDone(fullContent)
  } catch (err) {
    onError(err)
  }
}
