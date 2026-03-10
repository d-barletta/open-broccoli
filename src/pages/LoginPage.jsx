import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      if (!username.trim()) { setError('Username is required.'); return }
      if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return }
      if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
        setError('Username can only contain letters, numbers, underscores, and hyphens.')
        return
      }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, username.trim())
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-5xl">🥦</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">open-broccoli</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered Connect 4 — Online Multiplayer</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-8 shadow-2xl">
          {/* Mode switcher */}
          <div className="flex rounded-lg bg-gray-800/60 p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${mode === 'login' ? 'bg-yellow-500 text-gray-900 shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(null) }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${mode === 'register' ? 'bg-yellow-500 text-gray-900 shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Your unique username"
                  autoComplete="username"
                  required
                  className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                    text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                    focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                />
                <p className="text-gray-600 text-xs mt-1">Letters, numbers, _ and - only. Min 3 characters.</p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5
                  text-gray-100 placeholder-gray-500 text-sm focus:outline-none
                  focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
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
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
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
              {loading ? '...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-gray-600 text-xs text-center mt-4">
              The first registered user becomes admin.
            </p>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Powered by{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">
            OpenRouter
          </a>
        </p>
      </div>
    </div>
  )
}
