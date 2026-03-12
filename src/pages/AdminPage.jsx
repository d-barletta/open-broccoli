import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  getAdminPublicSettings, saveAdminPublicSettings,
  getAdminSecretSettings, saveAdminSecretSettings,
  getAllUsers, updateUserAdmin, getAllMatches,
} from '../services/firestoreService'
import PageFooter from '../components/PageFooter'

const TABS = ['settings', 'users', 'matches']

export default function AdminPage() {
  const { userProfile, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('settings')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [error, setError] = useState(null)

  // Settings tab
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [availableModels, setAvailableModels] = useState('')
  const [forceSameModel, setForceSameModel] = useState(false)
  const [forcedModel, setForcedModel] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Users tab
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Matches tab
  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    setLoading(false)
  }, [isAdmin, navigate])

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const [pub, sec] = await Promise.all([getAdminPublicSettings(), getAdminSecretSettings()])
      const models = pub?.availableModels || []
      setAvailableModels(models.join('\n'))
      setForceSameModel(pub?.forceSameModel === true)
      setForcedModel(pub?.forcedModel || models[0] || '')
      setOpenrouterApiKey(sec?.openrouterApiKey || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const u = await getAllUsers()
      setUsers(u)
    } catch (err) {
      setError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true)
    try {
      const m = await getAllMatches(100)
      setMatches(m)
    } catch (err) {
      setError(err.message)
    } finally {
      setMatchesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (activeTab === 'settings') loadSettings()
    else if (activeTab === 'users') loadUsers()
    else if (activeTab === 'matches') loadMatches()
  }, [activeTab, loading, loadSettings, loadUsers, loadMatches])

  async function handleSaveSettings(e) {
    e.preventDefault()
    setError(null)
    setSettingsLoading(true)
    try {
      const modelsList = availableModels.split('\n').map(s => s.trim()).filter(Boolean)
      const effectiveForcedModel = forcedModel.trim() || modelsList[0] || ''
      if (forceSameModel && !effectiveForcedModel) {
        throw new Error(t('admin.forceSameModelError'))
      }
      // Save available models to public doc (readable by all authenticated users)
      await saveAdminPublicSettings({
        availableModels: modelsList,
        forceSameModel,
        forcedModel: forceSameModel ? effectiveForcedModel : null,
      })
      // Save API key to secret doc (not readable by non-admin clients; Cloud Function uses Admin SDK)
      await saveAdminSecretSettings({ openrouterApiKey })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSettingsLoading(false)
    }
  }

  async function toggleBan(uid, isBanned) {
    try {
      await updateUserAdmin(uid, { isBanned: !isBanned })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isBanned: !isBanned } : u))
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleAdmin(uid, isAdm) {
    try {
      await updateUserAdmin(uid, { isAdmin: !isAdm })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isAdmin: !isAdm } : u))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">{t('admin.loading')}</div>
      </div>
    )
  }

  // Stats
  const totalMatches = matches.length
  const completedMatches = matches.filter(m => m.status === 'finished').length
  const ongoingMatches = matches.filter(m => m.status === 'playing').length
  const waitingMatches = matches.filter(m => m.status === 'waiting_p2').length

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">🥦</span>
              <span className="font-black text-sm text-gray-300 tracking-tight">open-broccoli</span>
            </button>
            <span className="text-xs px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg font-medium">
              {t('admin.badge')}
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs text-gray-500">👤 {userProfile?.username}</span>
            <button onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all">
              {t('common.signOut')}
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="sm:hidden p-2 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 transition-all"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-800/60 bg-gray-950/95 px-4 py-3 flex flex-col gap-2">
            <span className="text-xs text-gray-500">👤 {userProfile?.username}</span>
            <button
              onClick={() => { logout(); setMobileMenuOpen(false) }}
              className="text-xs px-3 py-2 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all font-medium text-left"
            >
              {t('common.signOut')}
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-1">{t('admin.pageTitle')}</h1>
          <p className="text-gray-500 text-sm">{t('admin.pageDescription')}</p>
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm mb-6 flex gap-2">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* Stats overview */}
        {matches.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: t('admin.statTotalMatches'), value: totalMatches, color: 'text-blue-400' },
              { label: t('admin.statCompleted'), value: completedMatches, color: 'text-green-400' },
              { label: t('admin.statInProgress'), value: ongoingMatches, color: 'text-yellow-400' },
              { label: t('admin.statWaiting'), value: waitingMatches, color: 'text-gray-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 text-center">
                <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-800/40 p-1 mb-6 w-fit">
          {TABS.map(tab => {
            const tabLabel = { settings: t('admin.tabSettings'), users: t('admin.tabUsers'), matches: t('admin.tabMatches') }[tab]
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all
                  ${activeTab === tab ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {tabLabel}
              </button>
            )
          })}
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="max-w-xl flex flex-col gap-6">
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">{t('admin.settingsTitle')}</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                    {t('admin.apiKeyLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={openrouterApiKey}
                      onChange={e => setOpenrouterApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                        text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                        focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all pr-10"
                    />
                    <button type="button" onClick={() => setShowApiKey(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
                      {showApiKey ? '🙈' : '👁'}
                    </button>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">
                    {t('admin.apiKeyHint')}{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline">
                      {t('admin.getKey')}
                    </a>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                    {t('admin.availableModelsLabel')}
                  </label>
                  <textarea
                    value={availableModels}
                    onChange={e => setAvailableModels(e.target.value)}
                    placeholder={`openai/gpt-4o-mini\nanthropic/claude-3-haiku\nmeta-llama/llama-3.1-8b-instruct`}
                    rows={6}
                    className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                      text-gray-100 placeholder-gray-500 text-sm font-mono focus:outline-none
                      focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none"
                  />
                  <p className="text-gray-600 text-xs mt-1">
                    {t('admin.availableModelsHint')}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-700/60 bg-gray-800/30 p-4">
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={forceSameModel}
                      onChange={e => setForceSameModel(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500/40"
                    />
                    <span className="text-sm font-semibold text-gray-200">{t('admin.forceSameModel')}</span>
                  </label>

                  {forceSameModel && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                        {t('admin.forcedModelLabel')}
                      </label>
                      <select
                        value={forcedModel}
                        onChange={e => setForcedModel(e.target.value)}
                        className="w-full bg-gray-800/80 border border-gray-600/50 rounded-lg px-3 py-2.5 text-gray-100 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                      >
                        {[...new Set(availableModels.split('\n').map(s => s.trim()).filter(Boolean))].map(modelId => (
                          <option key={modelId} value={modelId}>{modelId}</option>
                        ))}
                      </select>
                      <p className="text-gray-500 text-xs mt-2">
                        {t('admin.forcedModelHint')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {saved && (
              <div className="bg-green-950/40 border border-green-500/30 rounded-lg px-4 py-2.5 text-green-300 text-sm flex gap-2">
                <span>✓</span><span>{t('admin.settingsSaved')}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={settingsLoading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500
                text-white font-bold rounded-xl transition-all active:scale-95 w-fit"
            >
              {settingsLoading ? t('admin.savingSettings') : t('admin.saveSettings')}
            </button>
          </form>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('admin.usersTitle', { count: users.length })}</h2>
              <button onClick={loadUsers}
                className="text-xs px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 text-gray-400 rounded-lg hover:text-gray-200 transition-all">
                {t('common.refresh')}
              </button>
            </div>

            {usersLoading ? (
              <div className="text-gray-400 text-sm">{t('admin.loadingUsers')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/60">
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colUsername')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colEmail')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colGames')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colJoined')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colStatus')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.uid} className="border-b border-gray-800/40 hover:bg-gray-900/40 transition-colors">
                        <td className="py-3 px-3 font-medium text-gray-200">
                          {u.username}
                          {u.isAdmin && <span className="ml-1.5 text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">admin</span>}
                        </td>
                        <td className="py-3 px-3 text-gray-400">{u.email}</td>
                        <td className="py-3 px-3 text-gray-400">
                          {t('admin.played', { played: u.matchesPlayed || 0, won: u.matchesWon || 0 })}
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs">
                          {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-3">
                          {u.isBanned
                            ? <span className="text-xs text-red-400 bg-red-950/40 px-2 py-0.5 rounded">{t('admin.statusBanned')}</span>
                            : <span className="text-xs text-green-400 bg-green-950/30 px-2 py-0.5 rounded">{t('admin.statusActive')}</span>}
                        </td>
                        <td className="py-3 px-3">
                          {u.uid !== userProfile?.uid && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => toggleBan(u.uid, u.isBanned)}
                                className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-all"
                              >
                                {u.isBanned ? t('admin.unban') : t('admin.ban')}
                              </button>
                              <button
                                onClick={() => toggleAdmin(u.uid, u.isAdmin)}
                                className="text-xs px-2 py-1 rounded bg-purple-900/40 border border-purple-700/40 text-purple-300 hover:bg-purple-900/60 transition-all"
                              >
                                {u.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <div className="text-gray-500 text-sm py-4 text-center">{t('admin.noUsers')}</div>}
              </div>
            )}
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('admin.recentMatchesTitle')}</h2>
              <button onClick={loadMatches}
                className="text-xs px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 text-gray-400 rounded-lg hover:text-gray-200 transition-all">
                {t('common.refresh')}
              </button>
            </div>

            {matchesLoading ? (
              <div className="text-gray-400 text-sm">{t('admin.loadingMatches')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/60">
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colMatchId')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colPlayers')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colStatus2')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colWinner')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colMoves')}</th>
                      <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-gray-500">{t('admin.colCreated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(m => (
                      <tr key={m.id} className="border-b border-gray-800/40 hover:bg-gray-900/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-yellow-400 text-xs">{m.id}</td>
                        <td className="py-3 px-3 text-gray-300">
                          🔴 {m.player1Username || '—'}
                          {m.player2Username && <> vs 🟡 {m.player2Username}</>}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="py-3 px-3 text-gray-300">
                          {m.winnerUsername ? (
                            <span className="text-green-400">{m.winnerUsername}</span>
                          ) : m.winner === 'draw' ? (
                            <span className="text-gray-400">{t('common.draw')}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3 text-gray-400">{m.moveCount || '—'}</td>
                        <td className="py-3 px-3 text-gray-500 text-xs">
                          {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {matches.length === 0 && <div className="text-gray-500 text-sm py-4 text-center">{t('admin.noMatches')}</div>}
              </div>
            )}
          </div>
        )}
      </main>
      <PageFooter />
    </div>
  )
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const styles = {
    waiting_p2: 'text-gray-400 bg-gray-800/60',
    setup: 'text-blue-400 bg-blue-950/40',
    playing: 'text-yellow-400 bg-yellow-950/40',
    finished: 'text-green-400 bg-green-950/40',
  }
  const labels = {
    waiting_p2: t('admin.statusWaitingP2'),
    setup: t('admin.statusSetup'),
    playing: t('admin.statusPlaying'),
    finished: t('admin.statusFinished'),
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] || 'text-gray-400'}`}>
      {labels[status] || status}
    </span>
  )
}
