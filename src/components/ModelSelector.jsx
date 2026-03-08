import { useState } from 'react'

const POPULAR_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-70b-instruct',
  'mistralai/mistral-large',
  'deepseek/deepseek-chat',
]

export default function ModelSelector({ label, value, onChange, models, loading, side }) {
  const isBlue = side === 'left'
  const accentClass = isBlue
    ? 'border-blue-500/50 focus:border-blue-400 focus:ring-blue-500/20'
    : 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
  const labelClass = isBlue ? 'text-blue-400' : 'text-red-400'
  const badgeClass = isBlue
    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    : 'bg-red-500/20 text-red-300 border border-red-500/30'

  const displayModels = models.length > 0 ? models : POPULAR_MODELS.map(id => ({ id, name: id }))

  const selectedModel = displayModels.find(m => m.id === value)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold uppercase tracking-widest ${labelClass}`}>{label}</span>
        {selectedModel && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
            {selectedModel.name?.split('/').pop() || value.split('/').pop()}
          </span>
        )}
      </div>

      {loading ? (
        <div className={`w-full bg-gray-800/60 border ${accentClass} rounded-lg px-4 py-3 text-gray-500 text-sm`}>
          Loading models…
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full bg-gray-800/60 border ${accentClass} rounded-lg px-4 py-3 text-gray-100 text-sm
              focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all duration-200
              hover:bg-gray-800`}
          >
            {displayModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
