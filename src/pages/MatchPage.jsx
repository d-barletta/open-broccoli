import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import { useAuth } from '../contexts/AuthContext'
import {
  subscribeToMatch, subscribeToGameState, joinMatch,
  setPlayerReady, setPlayerNotReady,
  savePrivateConfig,
  initGameState, getAdminPublicSettings,
} from '../services/firestoreService'
import ModelSelector from '../components/ModelSelector'

// ─── Board constants ──────────────────────────────────────────────────────────
const ROWS = 6
const COLS = 7
const PLAYER_1 = 1
const PLAYER_2 = 2
const MIN_MOVES = 7
const MAX_MOVES = 42
const DEFAULT_MODEL_1 = 'openai/gpt-4o-mini'
const DEFAULT_MODEL_2 = 'anthropic/claude-3-haiku'

// ─── Board display helpers (client-side only — game logic runs on the server) ─
function createBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(0))
}

function nextMoveBetStep(current, dir, forbidden) {
  let v = current + dir
  if (v === forbidden) v += dir
  return Math.min(MAX_MOVES, Math.max(MIN_MOVES, v))
}

// ─── UI components ─────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

function BoardCell({ cell, isWinning, isLast, rowIdx, colIdx }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), rowIdx * 40 + colIdx * 20)
    return () => clearTimeout(t)
  }, [rowIdx, colIdx])

  let bg = 'bg-gray-900/90', shadow = 'shadow-inner', extra = ''
  if (cell === PLAYER_1) {
    bg = 'bg-red-500'; shadow = 'shadow-red-800/60'
    extra = isWinning ? 'ring-4 ring-red-300 ring-offset-1 scale-110 z-10' : ''
  } else if (cell === PLAYER_2) {
    bg = 'bg-yellow-400'; shadow = 'shadow-yellow-700/60'
    extra = isWinning ? 'ring-4 ring-yellow-200 ring-offset-1 scale-110 z-10' : ''
  }
  return (
    <div className={`w-10 h-10 rounded-full transition-all duration-300 relative
      ${bg} shadow-lg ${shadow} ${extra}
      ${visible ? 'opacity-100' : 'opacity-0'}
      ${isLast && cell !== 0 ? 'animate-drop-in' : ''}
      ${isWinning ? 'animate-pulse' : ''}`}
    />
  )
}

function ConnectBoard({ board, lastMove, winningCells, bet1 = null, bet2 = null }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1 mb-0.5 h-4">
        {Array(COLS).fill(0).map((_, c) => {
          const col1 = c + 1
          return (
            <div key={c} className="w-10 flex items-center justify-center gap-0.5">
              {bet1 === col1 && <span className="text-[10px]">🔴</span>}
              {bet2 === col1 && <span className="text-[10px]">🟡</span>}
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mb-1">
        {Array(COLS).fill(0).map((_, c) => {
          const col1 = c + 1
          const p1 = bet1 === col1, p2 = bet2 === col1
          return (
            <div key={c} className={`w-10 text-center text-xs font-bold
              ${p1 && p2 ? 'text-orange-400' : p1 ? 'text-red-400' : p2 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {c + 1}
            </div>
          )
        })}
      </div>
      <div className="bg-blue-700 rounded-2xl p-2 shadow-2xl shadow-blue-900/60" style={{ border: '4px solid #1d4ed8' }}>
        {board.map((row, r) => (
          <div key={r} className="flex gap-1 mb-1 last:mb-0">
            {row.map((cell, c) => {
              const isWin = winningCells?.some(([wr, wc]) => wr === r && wc === c)
              const isLast = lastMove?.row === r && lastMove?.col === c
              return <BoardCell key={c} cell={cell} isWinning={isWin} isLast={isLast} rowIdx={r} colIdx={c} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ThinkingPanel({ playerNum, username, model, thinking, isThinking, lastCol, large }) {
  const isP1 = playerNum === PLAYER_1
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [thinking])
  return (
    <div className={`rounded-xl overflow-hidden flex flex-col h-full ${large ? 'min-h-[300px] max-h-[300px]' : ''}
      ${isP1
        ? 'bg-gradient-to-br from-red-950/40 to-gray-900/60 border border-red-500/20'
        : 'bg-gradient-to-br from-yellow-950/40 to-gray-900/60 border border-yellow-500/20'}`}>
      <div className={`flex items-center justify-between px-4 py-3 flex-shrink-0
        ${isP1 ? 'border-b border-red-500/20 bg-red-950/30' : 'border-b border-yellow-500/20 bg-yellow-950/30'}`}>
        <div className="flex items-center gap-2">
          <span>{isP1 ? '🔴' : '🟡'}</span>
          <div>
            <div className={`font-bold text-sm ${isP1 ? 'text-red-300' : 'text-yellow-300'}`}>
              {username || `Player ${playerNum}`}
            </div>
            <div className="text-gray-500 text-xs truncate max-w-[130px]">{model || '—'}</div>
          </div>
        </div>
        {isThinking && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium animate-pulse
            ${isP1 ? 'bg-red-500/20 text-red-300 border-red-400/50' : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50'}`}>
            Thinking…
          </span>
        )}
        {lastCol !== null && !isThinking && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
            ${isP1 ? 'bg-red-900/40 text-red-400 border-red-500/30' : 'bg-yellow-900/40 text-yellow-400 border-yellow-500/30'}`}>
            Played col {lastCol + 1}
          </span>
        )}
      </div>
      <div ref={scrollRef} className={`p-3 overflow-y-auto flex-1 ${large ? 'min-h-0' : 'min-h-[80px] max-h-[160px]'}`}>
        {isThinking && !thinking && <LoadingDots />}
        {thinking ? (
          <p className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {thinking}
            {isThinking && <span className="typing-cursor" />}
          </p>
        ) : !isThinking && (
          <div className="flex items-center justify-center h-full min-h-[40px] text-gray-600 text-xs">
            Waiting for turn…
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bet components ────────────────────────────────────────────────────────────
function BetSelector({ player, columnBet, onColumnBet, moveBet, onMoveBet }) {
  const isP1 = player === 1
  const accentText = isP1 ? 'text-red-400' : 'text-yellow-400'
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${accentText}`}>
          💰 Bet: winning column?
        </label>
        <p className="text-gray-500 text-xs mb-2">Pick which column the final winning piece will land in.</p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: COLS }, (_, i) => i + 1).map(col => (
            <button
              key={col}
              type="button"
              onClick={() => onColumnBet(columnBet === col ? null : col)}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all active:scale-95
                ${columnBet === col
                  ? isP1 ? 'bg-red-500 text-white shadow-lg' : 'bg-yellow-400 text-gray-900 shadow-lg'
                  : 'bg-gray-800/60 border border-gray-600/40 text-gray-400 hover:border-gray-400/60 hover:text-gray-200'}`}
            >
              {col}
            </button>
          ))}
          {columnBet !== null && (
            <button type="button" onClick={() => onColumnBet(null)}
              className="px-2 h-9 rounded-lg text-xs text-gray-500 bg-gray-800/40 border border-gray-700/40 hover:text-gray-300 transition-all">
              Clear
            </button>
          )}
        </div>
        {columnBet !== null && (
          <p className={`text-xs mt-1.5 ${accentText}`}>Betting on column {columnBet} 🎯</p>
        )}
      </div>

      <div>
        <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${accentText}`}>
          🎲 Bet: number of moves?
        </label>
        <p className="text-gray-500 text-xs mb-2">Guess total moves ({MIN_MOVES}–{MAX_MOVES}). Closest wins!</p>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => {
              const start = moveBet === null ? Math.floor((MIN_MOVES + MAX_MOVES) / 2) : moveBet
              onMoveBet(nextMoveBetStep(start, -1, null))
            }}
            className="w-9 h-9 rounded-lg bg-gray-800/60 border border-gray-600/40 text-gray-300
              hover:border-gray-400/60 hover:text-white active:scale-95 transition-all font-bold text-lg">−</button>
          <select
            value={moveBet === null ? '' : moveBet}
            onChange={e => { const v = parseInt(e.target.value, 10); onMoveBet(isNaN(v) ? null : v) }}
            className={`h-9 w-28 bg-gray-800/60 border rounded-lg px-2 text-gray-100 text-sm
              focus:outline-none focus:ring-2 transition-all text-center
              ${isP1 ? 'border-red-500/40 focus:border-red-400 focus:ring-red-500/20' : 'border-yellow-500/40 focus:border-yellow-400 focus:ring-yellow-500/20'}`}>
            <option value="">— pick —</option>
            {Array.from({ length: MAX_MOVES - MIN_MOVES + 1 }, (_, i) => i + MIN_MOVES).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button type="button"
            onClick={() => {
              const start = moveBet === null ? Math.floor((MIN_MOVES + MAX_MOVES) / 2) : moveBet
              onMoveBet(nextMoveBetStep(start, 1, null))
            }}
            className="w-9 h-9 rounded-lg bg-gray-800/60 border border-gray-600/40 text-gray-300
              hover:border-gray-400/60 hover:text-white active:scale-95 transition-all font-bold text-lg">+</button>
          {moveBet !== null && (
            <button type="button" onClick={() => onMoveBet(null)}
              className="px-2 h-9 rounded-lg text-xs text-gray-500 bg-gray-800/40 border border-gray-700/40 hover:text-gray-300 transition-all">
              Clear
            </button>
          )}
        </div>
        {moveBet !== null && (
          <p className={`text-xs mt-1.5 ${accentText}`}>Betting on {moveBet} moves 🎲</p>
        )}
      </div>
    </div>
  )
}

// ─── Main MatchPage ────────────────────────────────────────────────────────────
export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile, signInAsGuest, isAnonymous } = useAuth()

  const [match, setMatch] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Player setup form state
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_1)
  const [instructions, setInstructions] = useState('')
  const [columnBet, setColumnBet] = useState(null)
  const [moveBet, setMoveBet] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [lottieData, setLottieData] = useState(null)
  const [guestUsername, setGuestUsername] = useState('')
  const [guestJoinLoading, setGuestJoinLoading] = useState(false)
  const startGameRequestedRef = useRef(false)

  // Determine which player number I am
  const myPlayerNum = match
    ? (match.player1Uid === currentUser?.uid ? 1 : match.player2Uid === currentUser?.uid ? 2 : null)
    : null

  const isSpectator = myPlayerNum === null && match !== null

  // Subscribe to match doc
  useEffect(() => {
    if (!matchId || !currentUser) return
    setLoading(true)
    const unsub = subscribeToMatch(matchId, (data) => {
      setMatch(data)
      setLoading(false)
      if (!data) setError('Match not found.')
    })
    return unsub
  }, [matchId, currentUser?.uid])

  // Subscribe to game state when playing or finished
  useEffect(() => {
    if (!match || (match.status !== 'playing' && match.status !== 'finished')) return
    const unsub = subscribeToGameState(matchId, (gs) => {
      setGameState(gs)
    })
    return unsub
  }, [matchId, match?.status])

  // Load lottie when game ends with a winner
  useEffect(() => {
    if (match?.status === 'finished' && match?.winner !== 'draw' && match?.winner !== null) {
      fetch('https://assets.lottiefiles.com/packages/lf20_touohxv0.json')
        .then(r => r.json()).then(setLottieData).catch(() => {})
    }
  }, [match?.status, match?.winner])

  // Auto-join as P2 if we're logged in and match needs P2
  useEffect(() => {
    if (!match || !currentUser || !userProfile) return
    if (match.status !== 'waiting_p2') return
    if (match.player1Uid === currentUser.uid) return
    joinMatch(matchId, currentUser.uid, userProfile.username).catch(err => {
      setJoinError(err.message)
    })
  }, [match?.status, match?.player1Uid, currentUser?.uid, userProfile?.username, matchId])

  async function handleGuestJoin(e) {
    e.preventDefault()
    setError(null)
    setGuestJoinLoading(true)
    try {
      await signInAsGuest(guestUsername)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuestJoinLoading(false)
    }
  }

  // Fetch model list from admin public settings
  useEffect(() => {
    if (!currentUser) return
    setModelsLoading(true)
    getAdminPublicSettings().then(settings => {
      if (settings?.availableModels?.length > 0) {
        setModels(settings.availableModels.map(id => ({ id, name: id })))
      }
      // If no models configured, ModelSelector falls back to its hardcoded popular list
    }).catch(() => {}).finally(() => setModelsLoading(false))
  }, [currentUser])

  // Set default model based on player number
  useEffect(() => {
    if (myPlayerNum === 1) setSelectedModel(DEFAULT_MODEL_1)
    else if (myPlayerNum === 2) setSelectedModel(DEFAULT_MODEL_2)
  }, [myPlayerNum])

  // Trigger the Vercel AI endpoint whenever the server signals a move is needed.
  // Uses moveCount+currentPlayer as a key to fire exactly once per pending move.
  // For Firebase Cloud Function deployments the fetch will silently fail (no
  // /api/ai-move route) and the CF handles the move via the Firestore trigger.
  const aiTriggerKeyRef = useRef(null)
  useEffect(() => {
    if (!gameState) return
    if (!gameState.pendingAiMove || gameState.isThinking || gameState.winner !== null) return
    if (!currentUser) return

    const moveKey = `${gameState.moveCount}-${gameState.currentPlayer}`
    if (aiTriggerKeyRef.current === moveKey) return
    aiTriggerKeyRef.current = moveKey

    currentUser.getIdToken().then(token => {
      fetch('/api/ai-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId }),
      }).then(res => {
        if (!res.ok && res.status !== 404) {
          // 404 is expected for Firebase CF deployments (no /api/ai-move route)
          console.warn('[ai-move] Unexpected response from /api/ai-move:', res.status)
        }
      }).catch(() => {
        // Network errors are expected for Firebase CF deployments
      })
    }).catch(() => {})
  }, [gameState?.pendingAiMove, gameState?.isThinking, gameState?.winner,
    gameState?.moveCount, gameState?.currentPlayer, matchId, currentUser])

  // Start game when both players are ready (Player 1 initialises game state,
  // which sets pendingAiMove=true — the Vercel function above picks this up and
  // processes the first move; Firebase CF deployments use the Firestore trigger).
  useEffect(() => {
    startGameRequestedRef.current = false
  }, [matchId])

  useEffect(() => {
    if (!match || match.status !== 'setup') return
    if (!match.player1Ready || !match.player2Ready) return
    if (myPlayerNum !== 1) return
    if (startGameRequestedRef.current) return
    startGameRequestedRef.current = true
    initGameState(matchId, createBoard()).catch(err => {
      startGameRequestedRef.current = false
      setError(err.message)
    })
  }, [match?.player1Ready, match?.player2Ready, match?.status, myPlayerNum, matchId])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleReady() {
    if (!myPlayerNum) return
    if (columnBet === null || moveBet === null || !selectedModel) return
    setSavingConfig(true)
    try {
      await savePrivateConfig(matchId, myPlayerNum, currentUser.uid, {
        model: selectedModel,
        instructions,
        columnBet,
        moveBet,
      })
      await setPlayerReady(matchId, myPlayerNum, { model: selectedModel, columnBet, moveBet })
      setIsReady(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleCancelReady() {
    if (!myPlayerNum) return
    try {
      await setPlayerNotReady(matchId, myPlayerNum)
      setIsReady(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function copyMatchLink() {
    const base = import.meta.env.BASE_URL || '/'
    const url = `${window.location.origin}${base}#/match/${matchId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  function copyMatchCode() {
    navigator.clipboard.writeText(matchId).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  // ── Render states ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-gray-900/80 border border-gray-700/60 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔗</div>
            <h1 className="text-2xl font-black text-white mb-2">Join Match {matchId}</h1>
            <p className="text-sm text-gray-400">
              Sign in with your account, or enter a username to join this match as a guest.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-500/40 rounded-lg px-3 py-2.5 text-red-300 text-sm flex gap-2 items-start mb-4">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-4">
            <button
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/match/${matchId}`)}`)}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-gray-900 font-black text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-yellow-500/20 active:scale-95"
            >
              Sign In or Register
            </button>

            <div className="relative flex items-center justify-center text-xs uppercase tracking-widest text-gray-600">
              <span className="absolute inset-x-0 h-px bg-gray-800" />
              <span className="relative bg-gray-900 px-3">or join as guest</span>
            </div>

            <form onSubmit={handleGuestJoin} className="flex flex-col gap-3">
              <input
                type="text"
                value={guestUsername}
                onChange={e => setGuestUsername(e.target.value)}
                placeholder="Choose a guest username"
                className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2.5 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
              <button
                type="submit"
                disabled={guestJoinLoading}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-black text-base rounded-xl transition-all duration-200 active:scale-95"
              >
                {guestJoinLoading ? 'Joining…' : 'Join as Guest'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingDots />
      </div>
    )
  }

  if (error || joinError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{error || joinError}</div>
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white underline text-sm">
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!match) return null

  // ── WAITING FOR P2 ────────────────────────────────────────────────────────
  if (match.status === 'waiting_p2') {
    return (
      <MatchLayout matchId={matchId} navigate={navigate}>
        <div className="text-center py-16 max-w-lg mx-auto">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-2xl font-black text-white mb-2">Waiting for Player 2</h2>
          <p className="text-gray-400 text-sm mb-8">
            Share this match with your opponent. Once they join, you'll both configure your AIs!
          </p>

          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-6 mb-6">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Match Code</div>
            <div className="text-3xl font-black text-yellow-400 font-mono tracking-widest mb-4">{matchId}</div>
            <div className="flex gap-2 justify-center">
              <button onClick={copyMatchCode}
                className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-all">
                {copySuccess ? '✓ Copied!' : '📋 Copy Code'}
              </button>
              <button onClick={copyMatchLink}
                className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-sm rounded-lg hover:bg-yellow-500/30 transition-all">
                🔗 Copy Link
              </button>
            </div>
          </div>

          <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
            <div className="text-sm font-bold text-red-300 mb-1">
              🔴 {match.player1Username} {match.player1Uid === currentUser?.uid ? '(You — Player 1)' : '(Player 1)'}
            </div>
            <div className="text-gray-500 text-xs">
              {match.player1Uid === currentUser?.uid ? 'Waiting for opponent to join…' : 'This seat is reserved for Player 1.'}
            </div>
          </div>

          {isAnonymous && (
            <div className="mt-4 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
              Joined as guest {userProfile?.username}. You can finish this match without creating an account.
            </div>
          )}
        </div>
      </MatchLayout>
    )
  }

  // ── SETUP PHASE ───────────────────────────────────────────────────────────
  if (match.status === 'setup') {
    const myReady = myPlayerNum === 1 ? match.player1Ready : match.player2Ready
    const theirReady = myPlayerNum === 1 ? match.player2Ready : match.player1Ready
    const isP1 = myPlayerNum === 1

    return (
      <MatchLayout matchId={matchId} navigate={navigate}>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl">{isP1 ? '🔴' : '🟡'}</span>
              <h2 className="text-2xl font-black text-white">Configure Your AI</h2>
            </div>
            <p className="text-gray-400 text-sm">
              Your setup is <strong className="text-yellow-300">private</strong> — your opponent can't see your instructions.
            </p>
          </div>

          {/* Opponent status */}
          <div className={`flex gap-3 rounded-xl p-4 mb-6 border ${
            theirReady
              ? 'bg-green-950/30 border-green-500/30'
              : 'bg-gray-900/60 border-gray-700/50'
          }`}>
            <span className="text-lg">{isP1 ? '🟡' : '🔴'}</span>
            <div>
              <div className="text-sm font-bold text-gray-300">
                {isP1 ? match.player2Username : match.player1Username} (Opponent)
              </div>
              <div className={`text-xs ${theirReady ? 'text-green-400' : 'text-gray-500'}`}>
                {theirReady ? '✓ Ready!' : 'Still configuring…'}
              </div>
            </div>
          </div>

          {/* My setup form */}
          {!myReady ? (
            <div className={`rounded-xl overflow-hidden border ${isP1 ? 'border-red-500/30 bg-gradient-to-br from-red-950/40 to-gray-900/60' : 'border-yellow-500/30 bg-gradient-to-br from-yellow-950/40 to-gray-900/60'}`}>
              <div className={`px-4 py-3 border-b ${isP1 ? 'border-red-500/30 bg-red-950/30' : 'border-yellow-500/30 bg-yellow-950/30'}`}>
                <div className="font-bold text-sm text-gray-200">Your Configuration (Private)</div>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <ModelSelector
                  label="🤖 Your AI Model"
                  value={selectedModel}
                  onChange={setSelectedModel}
                  models={models}
                  loading={modelsLoading}
                  side={isP1 ? 'left' : 'right'}
                />
                <div>
                  <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
                    🔒 Instructions for your AI (private)
                  </label>
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder={`Tell your AI how to play… e.g. "Play aggressively, always look for immediate winning moves first."`}
                    rows={3}
                    className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-gray-100
                      placeholder-gray-500 text-sm focus:outline-none focus:border-yellow-500/50
                      focus:ring-1 focus:ring-yellow-500/20 transition-all resize-none"
                  />
                  <p className="text-gray-600 text-xs mt-1">🔒 Your opponent cannot see these instructions</p>
                </div>
                <BetSelector
                  player={myPlayerNum}
                  columnBet={columnBet} onColumnBet={setColumnBet}
                  moveBet={moveBet} onMoveBet={setMoveBet}
                />
              </div>
            </div>
          ) : (
            <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-green-300 font-bold text-lg">You're Ready!</div>
              <div className="text-gray-400 text-sm mt-1">
                {theirReady ? 'Both players ready — game starting…' : 'Waiting for your opponent…'}
              </div>
            </div>
          )}

          {/* Ready / Cancel button */}
          <div className="mt-6 flex justify-center gap-3">
            {!myReady ? (
              <button
                onClick={handleReady}
                disabled={savingConfig || columnBet === null || moveBet === null || !selectedModel}
                className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-500
                  hover:from-green-500 hover:to-emerald-400
                  disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
                  text-white font-black text-lg rounded-2xl transition-all duration-200
                  shadow-lg hover:shadow-green-500/30 active:scale-95"
              >
                {savingConfig ? 'Saving…' : 'I\'m Ready! ✓'}
              </button>
            ) : (
              <button
                onClick={handleCancelReady}
                className="px-6 py-2 bg-gray-800/60 border border-gray-600/50 text-gray-400
                  hover:text-gray-200 hover:border-gray-500 rounded-xl text-sm transition-all"
              >
                ← Edit My Config
              </button>
            )}
          </div>

          {!myReady && (columnBet === null || moveBet === null) && (
            <p className="text-center text-yellow-500/70 text-xs mt-3">
              ⚠ Place a column bet and a move-count bet to continue
            </p>
          )}
        </div>
      </MatchLayout>
    )
  }

  // ── PLAYING / FINISHED ────────────────────────────────────────────────────
  if (match.status === 'playing' || match.status === 'finished') {
    const gs = gameState
    if (!gs) {
      return (
        <MatchLayout matchId={matchId} navigate={navigate}>
          <div className="flex items-center justify-center py-20"><LoadingDots /></div>
        </MatchLayout>
      )
    }

    const board = gs.board || createBoard()
    const isMyTurn = !isSpectator && gs.currentPlayer === myPlayerNum && !gs.isThinking && gs.winner === null
    // thinking text: live streaming from Firestore (currentThinkingText) or completed last thinking
    const thinking1 = (gs.isThinking && gs.thinkingPlayer === 1) ? (gs.currentThinkingText || '') : (gs.player1LastThinking || '')
    const thinking2 = (gs.isThinking && gs.thinkingPlayer === 2) ? (gs.currentThinkingText || '') : (gs.player2LastThinking || '')
    const isThinking1 = gs.isThinking && gs.thinkingPlayer === 1
    const isThinking2 = gs.isThinking && gs.thinkingPlayer === 2

    if (match.status === 'finished') {
      const winnerLabel = match.winner === 'player1' ? `${match.player1Username} 🔴`
        : match.winner === 'player2' ? `${match.player2Username} 🟡` : null
      const winnerColor = match.winner === 'player1'
        ? 'from-red-500 via-red-400 to-orange-300'
        : match.winner === 'player2'
          ? 'from-yellow-300 via-yellow-400 to-orange-400'
          : 'from-gray-400 to-gray-300'

      return (
        <MatchLayout matchId={matchId} navigate={navigate}>
          <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 pb-12">
            <div className="text-center pt-8">
              <div className={`inline-block text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r ${winnerColor} bg-clip-text text-transparent animate-bounce-in`}>
                {match.winner === 'draw' ? "It's a Draw! 🤝" : `${winnerLabel} Wins!`}
              </div>
              <p className="text-gray-400 text-sm mt-3">Game over in {gs.moveCount || 0} moves</p>
              {!isSpectator && (
                <p className={`text-sm mt-1 font-bold ${
                  (match.winner === 'player1' && myPlayerNum === 1) || (match.winner === 'player2' && myPlayerNum === 2)
                    ? 'text-green-400' : match.winner === 'draw' ? 'text-gray-400' : 'text-red-400'}`}>
                  {(match.winner === 'player1' && myPlayerNum === 1) || (match.winner === 'player2' && myPlayerNum === 2)
                    ? '🏆 You won!' : match.winner === 'draw' ? "It's a draw!" : '😔 You lost.'}
                </p>
              )}
            </div>

            {/* Bet results */}
            <BetResults match={match} gs={gs} />

            {lottieData && match.winner !== 'draw' && (
              <div className="flex justify-center">
                <div className="w-48 h-48 pointer-events-none select-none">
                  <Lottie animationData={lottieData} loop />
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <ConnectBoard board={board} lastMove={gs.lastMove} winningCells={gs.winningCells}
                bet1={match.player1ColumnBet} bet2={match.player2ColumnBet} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ThinkingPanel playerNum={1} username={match.player1Username} model={match.player1Model}
                thinking={thinking1} isThinking={false} lastCol={null} />
              <ThinkingPanel playerNum={2} username={match.player2Username} model={match.player2Model}
                thinking={thinking2} isThinking={false} lastCol={null} />
            </div>

            <GameLog log={gs.moveLog || []} moveCount={gs.moveCount || 0} />

            <div className="flex justify-center">
              <button onClick={() => navigate(isAnonymous ? `/login?redirect=${encodeURIComponent(`/match/${matchId}`)}` : '/')}
                className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500
                  hover:from-indigo-400 hover:to-purple-400
                  text-white font-bold rounded-xl transition-all duration-200
                  shadow-lg hover:shadow-purple-500/30 active:scale-95">
                {isAnonymous ? 'Sign In/Up' : '← Back to Home'}
              </button>
            </div>
          </div>
        </MatchLayout>
      )
    }

    // PLAYING
    return (
      <MatchLayout matchId={matchId} navigate={navigate}>
        <div className="flex flex-col gap-4 w-full px-4 pb-12">
          <div className="text-center pt-6 pb-1">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl">🔴</span>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
                Connect 4
              </h1>
              <span className="text-3xl">🟡</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-bold text-sm
              ${gs.currentPlayer === PLAYER_1
                ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 animate-pulse'}`}>
              {gs.currentPlayer === PLAYER_1 ? '🔴' : '🟡'}
              {gs.isThinking
                ? ` ${gs.currentPlayer === PLAYER_1 ? match.player1Username : match.player2Username} is thinking…`
                : ` ${gs.currentPlayer === PLAYER_1 ? match.player1Username : match.player2Username}'s turn`}
              {` · Move ${gs.moveCount + 1}`}
            </div>
          </div>

          {gs.error && (
            <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm flex gap-2 max-w-5xl mx-auto w-full">
              <span>⚠</span><span>{gs.error}</span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full max-w-[1400px] mx-auto">
            <div className="flex-1 min-w-0">
              <ThinkingPanel playerNum={1} username={match.player1Username} model={match.player1Model}
                thinking={thinking1} isThinking={isThinking1}
                lastCol={gs.lastMove?.col != null && gs.currentPlayer !== 1 ? gs.lastMove.col : null}
                large />
            </div>
            <div className="flex-shrink-0 flex flex-col items-center justify-center">
              <ConnectBoard board={board} lastMove={gs.lastMove} winningCells={gs.winningCells}
                bet1={match.player1ColumnBet} bet2={match.player2ColumnBet} />
            </div>
            <div className="flex-1 min-w-0">
              <ThinkingPanel playerNum={2} username={match.player2Username} model={match.player2Model}
                thinking={thinking2} isThinking={isThinking2}
                lastCol={gs.lastMove?.col != null && gs.currentPlayer !== 2 ? gs.lastMove.col : null}
                large />
            </div>
          </div>

          <GameLog log={gs.moveLog || []} moveCount={gs.moveCount || 0} />
        </div>
      </MatchLayout>
    )
  }

  return null
}

// ─── Helper components ─────────────────────────────────────────────────────────
function MatchLayout({ matchId, navigate, children }) {
  const { userProfile, logout, isAdmin, isAnonymous } = useAuth()
  return (
    <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(isAnonymous && matchId ? `/match/${matchId}` : '/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">🥦</span>
              <span className="font-black text-sm text-gray-300 tracking-tight">open-broccoli</span>
            </button>
            {matchId && (
              <span className="text-xs px-2 py-1 bg-gray-800/60 border border-gray-700/40 text-gray-500 rounded-lg font-mono">
                Match: {matchId}
              </span>
            )}
            {isAnonymous && (
              <span className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg font-medium">
                Guest: {userProfile?.username || 'anonymous'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isAnonymous && isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="text-xs px-3 py-1.5 rounded-lg border bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all font-medium">
                ⚙ Admin
              </button>
            )}
            {isAnonymous ? (
              <button onClick={() => navigate(`/login?redirect=${encodeURIComponent(matchId ? `/match/${matchId}` : '/')}`)}
                className="text-xs px-3 py-1.5 rounded-lg border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all font-medium">
                Sign In/Up
              </button>
            ) : (
              <span className="text-xs text-gray-500 hidden sm:block">👤 {userProfile?.username}</span>
            )}
            <button onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

function GameLog({ log, moveCount }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [log])
  return (
    <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 max-w-[1400px] mx-auto w-full">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Game Log · {moveCount} moves</h3>
      <div ref={ref} className="max-h-32 overflow-y-auto space-y-0.5">
        {log.length === 0 && <div className="text-gray-600 text-xs">Game starting…</div>}
        {log.map((entry, i) => (
          <div key={i} className="text-xs text-gray-400 font-mono">{entry}</div>
        ))}
      </div>
    </div>
  )
}

function BetResults({ match, gs }) {
  const moveCount = gs?.moveCount || 0
  const lastMove = gs?.lastMove
  const winnerNum = match.winner === 'player1' ? 1 : match.winner === 'player2' ? 2 : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Column bet */}
      {(match.player1ColumnBet !== null || match.player2ColumnBet !== null) && (() => {
        const winCol = winnerNum !== null && lastMove ? lastMove.col + 1 : null
        const bets = [
          { label: match.player1Username, emoji: '🔴', bet: match.player1ColumnBet },
          { label: match.player2Username, emoji: '🟡', bet: match.player2ColumnBet },
        ].filter(b => b.bet !== null)
        if (!bets.length) return null
        const diffs = bets.map(b => winCol !== null ? Math.abs(b.bet - winCol) : null)
        const minDiff = winCol !== null ? Math.min(...diffs) : null
        return (
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 text-center">💰 Column Bet</h3>
            <p className="text-center text-xs text-gray-500 mb-3">
              {winCol !== null ? <>Winning column: <span className="text-gray-300 font-bold">col {winCol}</span></> : 'Draw'}
            </p>
            <div className="flex gap-3">
              {bets.map(({ label, emoji, bet }, idx) => {
                const diff = diffs[idx]
                const isWin = diff === minDiff && diff !== null
                return (
                  <div key={label} className={`flex-1 rounded-xl px-4 py-3 text-center border
                    ${winCol === null ? 'bg-gray-800/60 border-gray-600/40 text-gray-400'
                      : isWin ? 'bg-green-900/40 border-green-500/50 text-green-300' : 'bg-red-900/30 border-red-600/40 text-red-400'}`}>
                    <div className="font-bold text-sm mb-1">{emoji} {label}</div>
                    <div className="text-xs">Bet: col {bet}</div>
                    {winCol !== null && <div className="text-xs font-bold mt-1">{isWin ? `✓ ${diff === 0 ? 'Exact!' : `Off by ${diff}`}` : `Off by ${diff}`}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Move bet */}
      {(match.player1MoveBet !== null || match.player2MoveBet !== null) && (() => {
        const bets = [
          { label: match.player1Username, emoji: '🔴', bet: match.player1MoveBet },
          { label: match.player2Username, emoji: '🟡', bet: match.player2MoveBet },
        ].filter(b => b.bet !== null)
        if (!bets.length) return null
        const diffs = bets.map(b => Math.abs(b.bet - moveCount))
        const minDiff = Math.min(...diffs)
        return (
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 text-center">🎲 Move Count Bet</h3>
            <p className="text-center text-xs text-gray-500 mb-3">Actual: <span className="text-gray-300 font-bold">{moveCount} moves</span></p>
            <div className="flex gap-3">
              {bets.map(({ label, emoji, bet }, idx) => {
                const diff = diffs[idx]
                const isWin = diff === minDiff
                return (
                  <div key={label} className={`flex-1 rounded-xl px-4 py-3 text-center border
                    ${isWin ? 'bg-green-900/40 border-green-500/50 text-green-300' : 'bg-red-900/30 border-red-600/40 text-red-400'}`}>
                    <div className="font-bold text-sm mb-1">{emoji} {label}</div>
                    <div className="text-xs">Guessed: {bet}</div>
                    <div className="text-xs font-bold mt-1">{isWin ? `✓ ${diff === 0 ? 'Exact!' : `Off by ${diff}`}` : `Off by ${diff}`}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
