import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUserMatches } from '../services/firestoreService'

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value.seconds) return new Date(value.seconds * 1000)
  return null
}

function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleString()
}

function getMatchOutcome(match, uid) {
  const myPlayerNum = match.player1Uid === uid ? 1 : match.player2Uid === uid ? 2 : null
  const opponentName = myPlayerNum === 1 ? match.player2Username : match.player1Username

  if (!myPlayerNum) {
    return { label: 'Unknown', tone: 'text-gray-300 bg-gray-800/60 border-gray-700/50', opponentName: opponentName || '—' }
  }

  if (match.status !== 'finished') {
    const label = match.status === 'playing' ? 'In Progress' : match.status === 'setup' ? 'Setup' : 'Waiting'
    return { label, tone: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30', opponentName: opponentName || 'Waiting for opponent' }
  }

  if (match.winner === 'draw') {
    return { label: 'Draw', tone: 'text-blue-300 bg-blue-500/10 border-blue-500/30', opponentName: opponentName || '—' }
  }

  const won = match.winner === `player${myPlayerNum}`
  return {
    label: won ? 'Won' : 'Lost',
    tone: won ? 'text-green-300 bg-green-500/10 border-green-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30',
    opponentName: opponentName || '—',
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser, userProfile, logout, isAdmin } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) return

    let cancelled = false
    setLoading(true)
    setError(null)

    getUserMatches(currentUser.uid, 100)
      .then((data) => {
        if (!cancelled) setMatches(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.uid])

  const stats = useMemo(() => {
    let wins = 0
    let losses = 0
    let draws = 0
    let inProgress = 0

    for (const match of matches) {
      const outcome = getMatchOutcome(match, currentUser?.uid)
      if (outcome.label === 'Won') wins += 1
      else if (outcome.label === 'Lost') losses += 1
      else if (outcome.label === 'Draw') draws += 1
      else inProgress += 1
    }

    return {
      total: matches.length,
      wins,
      losses,
      draws,
      inProgress,
    }
  }, [matches, currentUser?.uid])

  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">🥦</span>
              <span className="font-black text-sm text-gray-300 tracking-tight">open-broccoli</span>
            </button>
            <span className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-lg font-medium">
              My Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs px-3 py-1.5 rounded-lg border bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all font-medium"
              >
                Admin
              </button>
            )}
            <span className="text-xs text-gray-500 hidden sm:block">👤 {userProfile?.username}</span>
            <button
              onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white">Your Match Dashboard</h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Review your recent matches, see whether you won or lost, and jump back into games that are still running.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Matches', value: stats.total, tone: 'text-white' },
            { label: 'Wins', value: stats.wins, tone: 'text-green-300' },
            { label: 'Losses', value: stats.losses, tone: 'text-red-300' },
            { label: 'Draws', value: stats.draws, tone: 'text-blue-300' },
            { label: 'Open', value: stats.inProgress, tone: 'text-yellow-300' },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-4">
              <div className={`text-2xl font-black ${stat.tone}`}>{stat.value}</div>
              <div className="text-xs uppercase tracking-widest text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        <div className="bg-gray-900/60 border border-gray-700/50 rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800/60 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Matches</h2>
              <p className="text-xs text-gray-500 mt-1">Newest matches first. Ongoing games stay marked until they finish.</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs px-3 py-2 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-500 transition-all"
            >
              New Match
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-sm text-gray-400">Loading your matches…</div>
          ) : matches.length === 0 ? (
            <div className="px-5 py-10 text-sm text-gray-500">You have not played any matches yet.</div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {matches.map((match) => {
                const outcome = getMatchOutcome(match, currentUser?.uid)
                const amPlayer1 = match.player1Uid === currentUser?.uid
                const sideLabel = amPlayer1 ? 'Player 1' : 'Player 2'
                return (
                  <div key={match.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-black text-yellow-300 font-mono tracking-wider">{match.id}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${outcome.tone}`}>{outcome.label}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-800/70 border border-gray-700/50 text-gray-300">{sideLabel}</span>
                      </div>
                      <div className="text-sm text-gray-200 mb-1">
                        vs <span className="font-semibold text-white">{outcome.opponentName}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Created {formatDate(match.createdAt)}</span>
                        <span>Status {match.status}</span>
                        <span>Moves {match.moveCount ?? '—'}</span>
                        <span>Winner {match.winnerUsername || (match.winner === 'draw' ? 'Draw' : '—')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/match/${match.id}`)}
                        className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-bold transition-all active:scale-95"
                      >
                        Open Match
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
