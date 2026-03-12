// Client-side OpenRouter service — all calls go through the backend API.
// The OpenRouter API key never leaves the server.

const DEFAULT_MAX_TOKENS = 2048

/**
 * Fetch available models from the backend (which proxies OpenRouter using the
 * admin API key stored in Firestore).
 *
 * @param {string} authToken  Firebase ID token for authentication.
 */
export async function fetchModels(authToken) {
  const response = await fetch('/api/models', {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch models: ${response.status}`)
  }

  const data = await response.json()
  return data.models || []
}

/**
 * Stream a chat completion through the backend proxy.
 *
 * The backend enforces system prompts and validates/sanitizes all inputs.
 * The client only supplies the feature-specific payload (question, history,
 * board state, etc.) plus a Firebase ID token.
 *
 * @param {Object}   opts
 * @param {string}   opts.authToken          Firebase ID token.
 * @param {string}   opts.feature            "battle_arena" | "connect_four_local"
 * @param {string}   opts.model              Model ID, e.g. "openai/gpt-4o-mini"
 * @param {Object}   opts.payload            Feature-specific body fields.
 * @param {Function} opts.onChunk            Called with (delta, fullSoFar) for each chunk.
 * @param {Function} opts.onDone             Called with the full response text when done.
 * @param {Function} opts.onError            Called with an Error on failure.
 * @param {number}   [opts.maxTokens]        Max tokens (server enforces its own cap).
 */
export async function streamChatCompletion({
  authToken,
  feature,
  model,
  payload,
  onChunk,
  onDone,
  onError,
  maxTokens = DEFAULT_MAX_TOKENS,
}) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feature,
        model,
        maxTokens,
        ...payload,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `API error: ${response.status}`)
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
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))

          // Backend may forward an error object in the stream
          if (json.error) {
            throw new Error(json.error)
          }

          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onChunk(delta, fullContent)
          }
        } catch (parseErr) {
          if (!(parseErr instanceof SyntaxError)) {
            throw parseErr
          }
          // skip malformed SSE lines
        }
      }
    }

    onDone(fullContent)
  } catch (err) {
    onError(err)
  }
}
