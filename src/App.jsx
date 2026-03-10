import { useState, useEffect, useCallback } from 'react'
import BattleArena from './components/BattleArena'
import ConnectFourGame from './components/ConnectFourGame'
import ApiKeyModal from './components/ApiKeyModal'
import { fetchModels } from './services/openrouter'

const PAGES = { BATTLE: 'battle', CONNECT_FOUR: 'connect_four' }

const LS_KEY = 'openrouter_api_key'

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) || '')
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState(null)
  const [showKeyPanel, setShowKeyPanel] = useState(!localStorage.getItem(LS_KEY))
  const [page, setPage] = useState(PAGES.BATTLE)

  const saveApiKey = useCallback((key) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem(LS_KEY, key)
    } else {
      localStorage.removeItem(LS_KEY)
    }
  }, [])

  useEffect(() => {
    if (!apiKey) {
      setModels([])
      return
    }

    let cancelled = false
    setModelsLoading(true)
    setModelsError(null)

    fetchModels(apiKey)
      .then(data => {
        if (cancelled) return
        // sort by name and filter to text models
        const sorted = data
          .filter(m => m.id && !m.id.includes('vision') && m.context_length > 0)
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
        setModels(sorted)
      })
      .catch(err => {
        if (cancelled) return
        setModelsError(err.message)
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => { cancelled = true }
  }, [apiKey])

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      {/* Top bar */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥦</span>
              <span className="font-black text-sm text-gray-300 tracking-tight">open-broccoli</span>
            </div>

            {/* Navigation tabs */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setPage(PAGES.BATTLE)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                  ${page === PAGES.BATTLE
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-gray-800/40 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
              >
                ⚔️ Battle Arena
              </button>
              <button
                onClick={() => setPage(PAGES.CONNECT_FOUR)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                  ${page === PAGES.CONNECT_FOUR
                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                    : 'bg-gray-800/40 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
              >
                🎮 Connect Four
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {apiKey && models.length > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-green-400/70 bg-green-950/30 border border-green-500/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {models.length} models loaded
              </span>
            )}
            {modelsError && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-red-400/70 bg-red-950/30 border border-red-500/20 rounded-full px-3 py-1">
                ⚠ API error
              </span>
            )}
            <button
              onClick={() => setShowKeyPanel(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                ${apiKey
                  ? 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 animate-pulse'
                }`}
            >
              {apiKey ? '🔑 API Key' : '⚠ Set API Key'}
            </button>
          </div>
        </div>

        {/* API Key panel (collapsible) */}
        {showKeyPanel && (
          <div className="border-t border-gray-800/60 bg-gray-950/95">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <ApiKeyModal onSave={(k) => { saveApiKey(k); if (k) setShowKeyPanel(false) }} initialKey={apiKey} />
            </div>
          </div>
        )}
      </header>

      <main>
        {page === PAGES.BATTLE && (
          <BattleArena apiKey={apiKey} models={models} modelsLoading={modelsLoading} />
        )}
        {page === PAGES.CONNECT_FOUR && (
          <ConnectFourGame apiKey={apiKey} models={models} modelsLoading={modelsLoading} />
        )}
      </main>

      <footer className="border-t border-gray-800/40 py-6 text-center text-xs text-gray-700">
        <p>
          Powered by{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 underline underline-offset-2">
            OpenRouter
          </a>
          {' '}· Your API key is stored locally and never shared ·{' '}
          <a href="https://github.com/d-barletta/open-broccoli" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 underline underline-offset-2">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
