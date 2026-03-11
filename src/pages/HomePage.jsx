import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createMatch, getMatch } from '../services/firestoreService'

export default function HomePage() {
  const { userProfile, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [creatingMatch, setCreatingMatch] = useState(false)

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
    if (!code) { setJoinError('Please enter a match code.'); return }
    // Validate match exists
    try {
      const match = await getMatch(code)
      if (!match) { setJoinError('Match not found. Check the code and try again.'); return }
      navigate(`/match/${code}`)
    } catch {
      setJoinError('Could not find that match. Try again.')
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs px-3 py-1.5 rounded-lg border bg-cyan-500/10 border-cyan-500/30
                text-cyan-300 hover:bg-cyan-500/20 transition-all font-medium"
            >
              My Dashboard
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs px-3 py-1.5 rounded-lg border bg-purple-500/10 border-purple-500/30
                  text-purple-300 hover:bg-purple-500/20 transition-all font-medium"
              >
                ⚙ Admin
              </button>
            )}
            <span className="text-xs text-gray-500 hidden sm:block">
              👤 {userProfile?.username}
            </span>
            <button
              onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/50
                text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-5xl">🔴</span>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
              Connect 4
            </h1>
            <span className="text-5xl">🟡</span>
          </div>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Challenge a friend! Each player instructs their AI and places bets — then watch them battle live.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Welcome back, <span className="text-yellow-400 font-semibold">{userProfile?.username}</span>!
            {userProfile?.matchesPlayed > 0 && (
              <span className="ml-2">
                {userProfile.matchesPlayed} game{userProfile.matchesPlayed !== 1 ? 's' : ''} played
                · {userProfile.matchesWon} won
              </span>
            )}
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Use My Dashboard to review your own matches and see whether each one was won, lost, drawn, or still in progress.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Create Match */}
          <div className="bg-gradient-to-br from-red-950/60 to-gray-900/80 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">🎮</div>
            <div>
              <h2 className="text-xl font-black text-red-300 mb-1">Create Match</h2>
              <p className="text-gray-400 text-sm">
                Start a new game as Player 1. You'll get a link to share with your opponent.
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
              {creatingMatch ? 'Creating…' : '+ Create Match'}
            </button>
          </div>

          {/* Join Match */}
          <div className="bg-gradient-to-br from-yellow-950/60 to-gray-900/80 border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">🔗</div>
            <div>
              <h2 className="text-xl font-black text-yellow-300 mb-1">Join Match</h2>
              <p className="text-gray-400 text-sm">
                Have a match code or link? Enter it below to join as Player 2.
              </p>
            </div>
            <form onSubmit={handleJoinMatch} className="w-full flex flex-col gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Match code (e.g. AB12CD34)"
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
                Join Match →
              </button>
            </form>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 text-center">
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            {[
              { icon: '🎮', title: 'Create', desc: 'Player 1 creates a match and gets a shareable link' },
              { icon: '🔗', title: 'Share', desc: 'Send the link to your opponent (Player 2)' },
              { icon: '⚙', title: 'Setup', desc: 'Each player configures their AI and places bets privately' },
              { icon: '🤖', title: 'Play', desc: 'Watch the AIs battle live — best bet wins!' },
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

      <footer className="border-t border-gray-800/40 py-6 text-center text-xs text-gray-700">
        <p>
          Powered by{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 underline underline-offset-2">
            OpenRouter
          </a>
          {' '}· Your config is private ·{' '}
          <a href="https://github.com/d-barletta/open-broccoli" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 underline underline-offset-2">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
