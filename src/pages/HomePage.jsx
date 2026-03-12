import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { createMatch, getMatch } from '../services/firestoreService'
import PageFooter from '../components/PageFooter'

export default function HomePage() {
  const { userProfile, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [creatingMatch, setCreatingMatch] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleCreateMatch() {
    setCreatingMatch(true)
    try {
      const matchId = await createMatch(userProfile.uid, userProfile.username)
      navigate(`/match/${matchId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingMatch(false)
    }
  }

  async function handleJoinMatch(e) {
    e.preventDefault()
    setJoinError(null)
    const code = joinCode.trim().toUpperCase()
    if (!code) { setJoinError(t('home.errorNoCode')); return }
    try {
      const match = await getMatch(code)
      if (!match) { setJoinError(t('home.errorNotFound')); return }
      navigate(`/match/${code}`)
    } catch {
      setJoinError(t('home.errorTryAgain'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🥦</span>
            <span className="font-black text-sm text-gray-300 tracking-tight">open-broccoli</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs px-3 py-1.5 rounded-lg border bg-cyan-500/10 border-cyan-500/30
                text-cyan-300 hover:bg-cyan-500/20 transition-all font-medium"
            >
              {t('common.myDashboard')}
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs px-3 py-1.5 rounded-lg border bg-purple-500/10 border-purple-500/30
                  text-purple-300 hover:bg-purple-500/20 transition-all font-medium"
              >
                {t('common.admin')}
              </button>
            )}
            <span className="text-xs text-gray-500">👤 {userProfile?.username}</span>
            <button
              onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/50
                text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all font-medium"
            >
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
              onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false) }}
              className="text-xs px-3 py-2 rounded-lg border bg-cyan-500/10 border-cyan-500/30
                text-cyan-300 hover:bg-cyan-500/20 transition-all font-medium text-left"
            >
              {t('common.myDashboard')}
            </button>
            {isAdmin && (
              <button
                onClick={() => { navigate('/admin'); setMobileMenuOpen(false) }}
                className="text-xs px-3 py-2 rounded-lg border bg-purple-500/10 border-purple-500/30
                  text-purple-300 hover:bg-purple-500/20 transition-all font-medium text-left"
              >
                {t('common.admin')}
              </button>
            )}
            <button
              onClick={() => { logout(); setMobileMenuOpen(false) }}
              className="text-xs px-3 py-2 rounded-lg border bg-gray-800/60 border-gray-700/50
                text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all font-medium text-left"
            >
              {t('common.signOut')}
            </button>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-5xl">🔴</span>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
              {t('home.heroTitle')}
            </h1>
            <span className="text-5xl">🟡</span>
          </div>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            {t('home.heroTagline')}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {t('home.welcomeBack', { username: userProfile?.username })}
            {userProfile?.matchesPlayed > 0 && (
              <span className="ml-2">
                {t('home.gamesPlayed', { count: userProfile.matchesPlayed })}
                {' · '}
                {t('home.gamesWon', { count: userProfile.matchesWon })}
              </span>
            )}
          </p>
          <p className="text-gray-600 text-xs mt-2">
            {t('home.dashboardHint')}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Create Match */}
          <div className="bg-gradient-to-br from-red-950/60 to-gray-900/80 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">🎮</div>
            <div>
              <h2 className="text-xl font-black text-red-300 mb-1">{t('home.createMatchTitle')}</h2>
              <p className="text-gray-400 text-sm">
                {t('home.createMatchDesc')}
              </p>
            </div>
            <button
              onClick={handleCreateMatch}
              disabled={creatingMatch}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500
                hover:from-red-400 hover:to-orange-400
                disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
                text-white font-black text-base rounded-xl transition-all duration-200
                shadow-lg hover:shadow-red-500/20 active:scale-95"
            >
              {creatingMatch ? t('home.creatingMatch') : t('home.createMatchBtn')}
            </button>
          </div>

          {/* Join Match */}
          <div className="bg-gradient-to-br from-yellow-950/60 to-gray-900/80 border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">🔗</div>
            <div>
              <h2 className="text-xl font-black text-yellow-300 mb-1">{t('home.joinMatchTitle')}</h2>
              <p className="text-gray-400 text-sm">
                {t('home.joinMatchDesc')}
              </p>
            </div>
            <form onSubmit={handleJoinMatch} className="w-full flex flex-col gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('home.matchCodePlaceholder')}
                maxLength={8}
                className="w-full bg-gray-800/60 border border-yellow-500/30 rounded-lg px-3 py-2.5
                  text-gray-100 placeholder-gray-500 text-sm text-center font-mono uppercase
                  focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/20 transition-all"
              />
              {joinError && (
                <p className="text-red-400 text-xs text-center">{joinError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500
                  hover:from-yellow-400 hover:to-orange-400
                  text-gray-900 font-black text-base rounded-xl transition-all duration-200
                  shadow-lg hover:shadow-yellow-500/20 active:scale-95"
              >
                {t('home.joinMatchBtn')}
              </button>
            </form>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 text-center">
            {t('home.howItWorks')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            {[
              { icon: '🎮', title: t('home.stepCreate'), desc: t('home.stepCreateDesc') },
              { icon: '🔗', title: t('home.stepShare'), desc: t('home.stepShareDesc') },
              { icon: '⚙', title: t('home.stepSetup'), desc: t('home.stepSetupDesc') },
              { icon: '🤖', title: t('home.stepPlay'), desc: t('home.stepPlayDesc') },
            ].map(step => (
              <div key={step.title} className="flex flex-col items-center gap-2">
                <div className="text-2xl">{step.icon}</div>
                <div className="text-sm font-bold text-gray-300">{step.title}</div>
                <div className="text-xs text-gray-500">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <PageFooter />
    </div>
  )
}
