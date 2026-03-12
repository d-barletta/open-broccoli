import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import PageFooter from '../components/PageFooter'

export default function LoginPage() {
  const { login, register, isAnonymous, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(isAnonymous ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const redirectTarget = searchParams.get('redirect') || '/'

  function selectMode(nextMode) {
    if (isAnonymous && nextMode === 'login') {
      setError(t('login.guestLoginWarn'))
      return
    }
    setMode(nextMode)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      if (!username.trim()) { setError(t('login.errorUsernameRequired')); return }
      if (username.trim().length < 3) { setError(t('login.errorUsernameMin')); return }
      if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
        setError(t('login.errorUsernameChars'))
        return
      }
      if (password !== confirmPassword) { setError(t('login.errorPasswordsNoMatch')); return }
      if (password.length < 6) { setError(t('login.errorPasswordMin')); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, username.trim())
      }
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      setError(err.message || t('login.errorSomethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-5xl">🥦</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">open-broccoli</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAnonymous
              ? t('login.upgradeGuestTagline', { username: userProfile?.username || 'guest' })
              : t('login.tagline')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-8 shadow-2xl">
          {/* Mode switcher */}
          <div className="flex rounded-lg bg-gray-800/60 p-1 mb-6">
            <button
              onClick={() => selectMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${mode === 'login' ? 'bg-yellow-500 text-gray-900 shadow' : 'text-gray-400 hover:text-gray-200'} ${isAnonymous ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isAnonymous ? t('login.existingAccountTab') : t('login.signInTab')}
            </button>
            <button
              onClick={() => selectMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${mode === 'register' ? 'bg-yellow-500 text-gray-900 shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {isAnonymous ? t('login.upgradeGuestTab') : t('login.registerTab')}
            </button>
          </div>

          {isAnonymous && (
            <div className="bg-cyan-950/50 border border-cyan-500/30 rounded-lg px-3 py-2.5 text-cyan-200 text-sm mb-4">
              {t('login.upgradeGuestNote')}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  {t('login.usernameLabel')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  autoComplete="username"
                  required
                  className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                    text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                    focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                />
                <p className="text-gray-600 text-xs mt-1">{t('login.usernameHint')}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                {t('login.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                required
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                  text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                  focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? t('login.passwordPlaceholderRegister') : t('login.passwordPlaceholderLogin')}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                    text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                    focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  {t('login.confirmPasswordLabel')}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('login.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  required
                  className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                    text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                    focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-lg px-3 py-2.5 text-red-300 text-sm flex gap-2 items-start">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500
                hover:from-yellow-400 hover:to-orange-400
                disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
                text-gray-900 font-black text-base rounded-xl transition-all duration-200
                shadow-lg hover:shadow-yellow-500/20 active:scale-95 mt-1"
            >
              {loading ? t('login.submitting') : mode === 'login' ? t('login.submitLogin') : isAnonymous ? t('login.submitUpgrade') : t('login.submitRegister')}
            </button>
          </form>

          {isAnonymous ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  navigate('/login', { replace: true })
                }}
                className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
              >
                {t('login.signOutGuest')}
              </button>
            </div>
          ) : mode === 'register' ? (
            <p className="text-gray-600 text-xs text-center mt-4">
              {t('login.firstUserAdmin')}
            </p>
          ) : null}
        </div>
        </div>
      </main>
      <PageFooter />
    </div>
  )
}
