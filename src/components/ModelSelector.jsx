import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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

function isModelFree(model) {
  const p = model.pricing
  if (!p) return false
  return (p.prompt === '0' || p.prompt === 0) && (p.completion === '0' || p.completion === 0)
}

const FILTER_KEYS = ['all', 'free', 'paid']

export default function ModelSelector({ label, value, onChange, models, loading, side }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')

  const isBlue = side === 'left'
  const accentClass = isBlue
    ? 'border-blue-500/50 focus:border-blue-400 focus:ring-blue-500/20'
    : 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
  const labelClass = isBlue ? 'text-blue-400' : 'text-red-400'
  const badgeClass = isBlue
    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    : 'bg-red-500/20 text-red-300 border border-red-500/30'
  const filterActiveClass = isBlue
    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
    : 'bg-red-500/20 border-red-500/40 text-red-300'

  const allModels = models.length > 0 ? models : POPULAR_MODELS.map(id => ({ id, name: id }))

  const hasPricingData = models.length > 0 && models.some(m => m.pricing)

  const displayModels = hasPricingData
    ? allModels.filter(m => {
        if (filter === 'free') return isModelFree(m)
        if (filter === 'paid') return !isModelFree(m)
        return true
      })
    : allModels

  const effectiveValue = displayModels.find(m => m.id === value)
    ? value
    : displayModels[0]?.id ?? value

  useEffect(() => {
    if (effectiveValue !== value && displayModels.length > 0) {
      onChange(effectiveValue)
    }
  }, [effectiveValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedModel = allModels.find(m => m.id === value)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-bold uppercase tracking-widest ${labelClass}`}>{label}</span>
        {selectedModel && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
            {selectedModel.name?.split('/').pop() || value.split('/').pop()}
          </span>
        )}
        {selectedModel && hasPricingData && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${isModelFree(selectedModel) ? 'bg-green-900/40 text-green-400 border-green-500/30' : 'bg-orange-900/40 text-orange-400 border-orange-500/30'}`}>
            {isModelFree(selectedModel) ? t('modelSelector.free') : t('modelSelector.paid')}
          </span>
        )}
      </div>

      {/* Free / Paid filter — only shown when pricing data is available */}
      {hasPricingData && (
        <div className="flex items-center gap-1">
          {FILTER_KEYS.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-medium
                ${filter === key
                  ? filterActiveClass
                  : 'bg-gray-800/40 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
            >
              {t(`modelSelector.${key}`)}
            </button>
          ))}
          <span className="text-xs text-gray-600 ml-1">
            {t('modelSelector.modelCount', { count: displayModels.length })}
          </span>
        </div>
      )}

      {loading ? (
        <div className={`w-full bg-gray-800/60 border ${accentClass} rounded-lg px-4 py-3 text-gray-500 text-sm`}>
          {t('modelSelector.loading')}
        </div>
      ) : (
        <div className="relative">
          <select
            value={effectiveValue}
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
