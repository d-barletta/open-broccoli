import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ApiKeyModal({ onSave, initialKey = '' }) {
  const { t } = useTranslation()
  const [key, setKey] = useState(initialKey)
  const [visible, setVisible] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    const trimmed = key.trim()
    if (!trimmed) return
    onSave(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    setKey('')
    onSave('')
  }

  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-lg">🔑</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-200 mb-1">{t('apiKey.title')}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('apiKey.description')}{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400/80 hover:text-yellow-400 underline underline-offset-2"
            >
              {t('apiKey.getKey')}
            </a>
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={visible ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="sk-or-v1-…"
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg pl-4 pr-10 py-2.5
                  text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-yellow-500/50
                  focus:ring-1 focus:ring-yellow-500/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setVisible(v => !v)}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {visible ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={!key.trim()}
              className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500
                text-gray-900 font-bold text-sm rounded-lg transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              {saved ? t('apiKey.saved') : t('apiKey.save')}
            </button>

            {initialKey && (
              <button
                onClick={handleClear}
                className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400
                  text-sm rounded-lg transition-all border border-gray-700/50"
                title={t('apiKey.clearTitle')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
