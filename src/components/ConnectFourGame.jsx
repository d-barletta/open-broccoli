import { useState, useRef, useEffect } from 'react'
import Lottie from 'lottie-react'
import ModelSelector from './ModelSelector'
import { streamChatCompletion } from '../services/openrouter'

// ─── Board constants ──────────────────────────────────────────────────────────
const ROWS = 6
const COLS = 7
const PLAYER_1 = 1
const PLAYER_2 = 2

const PHASES = {
  SETUP: 'setup',
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
}

const DEFAULT_MODEL_1 = 'openai/gpt-4o-mini'
const DEFAULT_MODEL_2 = 'anthropic/claude-3-haiku'

// Animation / timing constants
const PIECE_DROP_ANIMATION_MS = 500
const WINNER_ANIMATION_DELAY_MS = 400
const TURN_TRANSITION_MS = 200

// ─── Game logic helpers ───────────────────────────────────────────────────────
function createBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(0))
}

function dropPiece(board, col, player) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      const next = board.map(r => [...r])
      next[row][col] = player
      return { board: next, row }
    }
  }
  return { board, row: -1 }
}

function checkWinner(board, row, col, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of dirs) {
    let count = 1
    for (const sign of [1, -1]) {
      let r = row + sign * dr, c = col + sign * dc
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        count++; r += sign * dr; c += sign * dc
      }
    }
    if (count >= 4) return true
  }
  return false
}

function findWinningCells(board, row, col, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of dirs) {
    const cells = [[row, col]]
    for (const sign of [1, -1]) {
      let r = row + sign * dr, c = col + sign * dc
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        cells.push([r, c]); r += sign * dr; c += sign * dc
      }
    }
    if (cells.length >= 4) return cells
  }
  return []
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== 0)
}

function formatBoard(board) {
  const sym = { 0: '.', 1: 'R', 2: 'Y' }
  const header = '  1 2 3 4 5 6 7'
  const rows = board.map((row, i) => `${i + 1} ${row.map(c => sym[c]).join(' ')}`)
  return [header, ...rows].join('\n')
}

function parseMove(text) {
  // Prefer explicit MOVE: n tag — this is the required format
  const tagged = text.match(/MOVE\s*:\s*([1-7])/i)
  if (tagged) return parseInt(tagged[1]) - 1
  // Fallback: last standalone digit 1-7 (handles models that don't follow the format exactly)
  const nums = [...text.matchAll(/\b([1-7])\b/g)]
  if (nums.length > 0) return parseInt(nums[nums.length - 1][1]) - 1
  return -1
}

function pickValidColumn(board, preferred) {
  if (preferred >= 0 && preferred < COLS && board[0][preferred] === 0) return preferred
  // nearest valid column
  for (let d = 1; d < COLS; d++) {
    for (const sign of [1, -1]) {
      const c = preferred + sign * d
      if (c >= 0 && c < COLS && board[0][c] === 0) return c
    }
  }
  return -1
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────
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

// ─── Sub-components ────────────────────────────────────────────────────────────
// Min / max realistic move counts for a Connect Four game
const MIN_MOVES = 7   // fastest possible win (4 by one player, 3 by the other)
const MAX_MOVES = 42  // full board (6 × 7)

// Helper: skip over a forbidden value when stepping through move counts
function nextMoveBetStep(current, dir, forbidden) {
  let v = current + dir
  if (v === forbidden) v += dir
  return Math.min(MAX_MOVES, Math.max(MIN_MOVES, v))
}

function PlayerSetup({ player, model, onModelChange, instructions, onInstructionsChange,
  bet, onBetChange, otherBet,
  moveBet, onMoveBetChange, otherMoveBet,
  models, modelsLoading }) {
  const isP1 = player === 1
  return (
    <div className={`rounded-xl overflow-hidden ${isP1
      ? 'bg-gradient-to-br from-red-950/60 to-gray-900/80 border border-red-500/30'
      : 'bg-gradient-to-br from-yellow-950/60 to-gray-900/80 border border-yellow-500/30'}`}>
      <div className={`px-4 py-3 ${isP1 ? 'border-b border-red-500/30 bg-red-950/30' : 'border-b border-yellow-500/30 bg-yellow-950/30'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{isP1 ? '🔴' : '🟡'}</span>
          <div>
            <div className={`font-bold text-sm ${isP1 ? 'text-red-300' : 'text-yellow-300'}`}>
              Player {player}
            </div>
            <div className="text-gray-500 text-xs">Configure your AI</div>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <ModelSelector
          label="🤖 Model"
          value={model}
          onChange={onModelChange}
          models={models}
          loading={modelsLoading}
          side={isP1 ? 'left' : 'right'}
        />

        <div>
          <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
            Instructions for the AI
          </label>
          <textarea
            value={instructions}
            onChange={e => onInstructionsChange(e.target.value)}
            placeholder={`Tell the AI how to play as Player ${player}… e.g. "Play aggressively, always look for immediate winning moves first, then block the opponent."`}
            rows={5}
            className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-gray-100
              placeholder-gray-500 text-sm focus:outline-none focus:border-yellow-500/50
              focus:ring-1 focus:ring-yellow-500/20 transition-all resize-none"
          />
        </div>

        {/* Bet section */}
        <div>
          <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
            💰 Bet: winning column?
          </label>
          <p className="text-gray-500 text-xs mb-2">Pick which column the final winning piece will land in.</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: COLS }, (_, i) => i + 1).map(col => {
              const isMine = bet === col
              const isTaken = otherBet === col
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => !isTaken && onBetChange(isMine ? null : col)}
                  disabled={isTaken}
                  title={isTaken ? `Already taken by Player ${isP1 ? 2 : 1}` : undefined}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition-all active:scale-95
                    ${isTaken
                      ? 'bg-gray-800/30 border border-gray-700/30 text-gray-600 cursor-not-allowed opacity-50'
                      : isMine
                        ? isP1
                          ? 'bg-red-500 text-white shadow-lg shadow-red-700/40'
                          : 'bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-600/40'
                        : 'bg-gray-800/60 border border-gray-600/40 text-gray-400 hover:border-gray-400/60 hover:text-gray-200'
                    }`}
                >
                  {col}
                </button>
              )
            })}
            {bet !== null && (
              <button
                type="button"
                onClick={() => onBetChange(null)}
                className="px-2 h-9 rounded-lg text-xs text-gray-500 bg-gray-800/40 border border-gray-700/40 hover:text-gray-300 transition-all"
              >
                Clear
              </button>
            )}
          </div>
          {bet !== null && (
            <p className={`text-xs mt-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
              Betting on column {bet} 🎯
            </p>
          )}
        </div>

        {/* Move-count bet */}
        <div>
          <label className={`text-xs font-bold uppercase tracking-widest block mb-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
            🎲 Bet: number of moves?
          </label>
          <p className="text-gray-500 text-xs mb-2">
            Guess how many total moves the game will take ({MIN_MOVES}–{MAX_MOVES}). Closest guess wins!
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const start = moveBet === null ? Math.floor((MIN_MOVES + MAX_MOVES) / 2) : moveBet
                onMoveBetChange(nextMoveBetStep(start, -1, otherMoveBet))
              }}
              className="w-9 h-9 rounded-lg bg-gray-800/60 border border-gray-600/40 text-gray-300
                hover:border-gray-400/60 hover:text-white active:scale-95 transition-all font-bold text-lg"
            >−</button>
            <select
              value={moveBet === null ? '' : moveBet}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                onMoveBetChange(isNaN(v) ? null : v)
              }}
              className={`h-9 w-28 bg-gray-800/60 border rounded-lg px-2 py-2 text-gray-100 text-sm
                focus:outline-none focus:ring-2 transition-all text-center
                ${isP1
                  ? 'border-red-500/40 focus:border-red-400 focus:ring-red-500/20'
                  : 'border-yellow-500/40 focus:border-yellow-400 focus:ring-yellow-500/20'
                }`}
            >
              <option value="">— pick —</option>
              {Array.from({ length: MAX_MOVES - MIN_MOVES + 1 }, (_, i) => i + MIN_MOVES).map(n => (
                <option key={n} value={n} disabled={n === otherMoveBet}>
                  {n}{n === otherMoveBet ? ' (taken)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const start = moveBet === null ? Math.floor((MIN_MOVES + MAX_MOVES) / 2) : moveBet
                onMoveBetChange(nextMoveBetStep(start, 1, otherMoveBet))
              }}
              className="w-9 h-9 rounded-lg bg-gray-800/60 border border-gray-600/40 text-gray-300
                hover:border-gray-400/60 hover:text-white active:scale-95 transition-all font-bold text-lg"
            >+</button>
            {moveBet !== null && (
              <button
                type="button"
                onClick={() => onMoveBetChange(null)}
                className="px-2 h-9 rounded-lg text-xs text-gray-500 bg-gray-800/40 border border-gray-700/40 hover:text-gray-300 transition-all"
              >
                Clear
              </button>
            )}
          </div>
          {moveBet !== null && (
            <p className={`text-xs mt-1.5 ${isP1 ? 'text-red-400' : 'text-yellow-400'}`}>
              Betting on {moveBet} moves 🎲
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function BoardCell({ cell, isWinning, isLast, rowIdx, colIdx }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), rowIdx * 40 + colIdx * 20)
    return () => clearTimeout(t)
  }, [rowIdx, colIdx])

  let bg = 'bg-gray-900/90'
  let shadow = 'shadow-inner'
  let extra = ''

  if (cell === PLAYER_1) {
    bg = 'bg-red-500'
    shadow = 'shadow-red-800/60'
    extra = isWinning ? 'ring-4 ring-red-300 ring-offset-1 ring-offset-blue-800 scale-110 z-10' : ''
  } else if (cell === PLAYER_2) {
    bg = 'bg-yellow-400'
    shadow = 'shadow-yellow-700/60'
    extra = isWinning ? 'ring-4 ring-yellow-200 ring-offset-1 ring-offset-blue-800 scale-110 z-10' : ''
  }

  return (
    <div
      className={`w-10 h-10 rounded-full transition-all duration-300 relative
        ${bg} shadow-lg ${shadow} ${extra}
        ${visible ? 'opacity-100' : 'opacity-0'}
        ${isLast && cell !== 0 ? 'animate-drop-in' : ''}
        ${isWinning ? 'animate-pulse' : ''}
      `}
    />
  )
}

function ConnectBoard({ board, lastMove, winningCells, bet1 = null, bet2 = null }) {
  return (
    <div className="flex flex-col items-center">
      {/* Bet indicators row — above column numbers */}
      <div className="flex gap-1 mb-0.5 h-4">
        {Array(COLS).fill(0).map((_, c) => {
          const col1Based = c + 1
          const p1Here = bet1 === col1Based
          const p2Here = bet2 === col1Based
          return (
            <div key={c} className="w-10 flex items-center justify-center gap-0.5">
              {p1Here && <span className="text-[10px] leading-none" title="Player 1 bet" aria-label="Player 1 bet">🔴</span>}
              {p2Here && <span className="text-[10px] leading-none" title="Player 2 bet" aria-label="Player 2 bet">🟡</span>}
            </div>
          )
        })}
      </div>

      {/* Column labels */}
      <div className="flex gap-1 mb-1">
        {Array(COLS).fill(0).map((_, c) => {
          const col1Based = c + 1
          const p1Here = bet1 === col1Based
          const p2Here = bet2 === col1Based
          return (
            <div key={c} className={`w-10 text-center text-xs font-bold
              ${p1Here && p2Here ? 'text-orange-400' : p1Here ? 'text-red-400' : p2Here ? 'text-yellow-400' : 'text-gray-500'}`}
              aria-label={`Column ${c + 1}${p1Here && p2Here ? ', bet by Player 1 and Player 2' : p1Here ? ', Player 1 bet' : p2Here ? ', Player 2 bet' : ''}`}
            >
              {c + 1}
            </div>
          )
        })}
      </div>

      {/* Board frame */}
      <div className="bg-blue-700 rounded-2xl p-2 shadow-2xl shadow-blue-900/60"
        style={{ border: '4px solid #1d4ed8' }}>
        {board.map((row, r) => (
          <div key={r} className="flex gap-1 mb-1 last:mb-0">
            {row.map((cell, c) => {
              const isWin = winningCells?.some(([wr, wc]) => wr === r && wc === c)
              const isLast = lastMove?.row === r && lastMove?.col === c
              return (
                <BoardCell key={c} cell={cell} isWinning={isWin} isLast={isLast} rowIdx={r} colIdx={c} />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ThinkingPanel({ player, model, thinking, isThinking, lastCol, large }) {
  const isP1 = player === PLAYER_1
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [thinking])

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col h-full ${large ? 'min-h-[350px] max-h-[350px]' : ''} ${isP1
      ? 'bg-gradient-to-br from-red-950/40 to-gray-900/60 border border-red-500/20'
      : 'bg-gradient-to-br from-yellow-950/40 to-gray-900/60 border border-yellow-500/20'}`}
    >
      <div className={`flex items-center justify-between px-4 py-3 flex-shrink-0 ${isP1 ? 'border-b border-red-500/20 bg-red-950/30' : 'border-b border-yellow-500/20 bg-yellow-950/30'}`}>
        <div className="flex items-center gap-2">
          <span>{isP1 ? '🔴' : '🟡'}</span>
          <div>
            <div className={`font-bold text-sm ${isP1 ? 'text-red-300' : 'text-yellow-300'}`}>
              Player {player}
            </div>
            <div className="text-gray-500 text-xs truncate max-w-[130px]">{model}</div>
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

      <div ref={scrollRef} className={`p-3 overflow-y-auto flex-1 ${large ? 'min-h-0' : 'min-h-[100px] max-h-[180px]'}`}>
        {isThinking && !thinking && <LoadingDots />}
        {thinking ? (
          <p className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {thinking}
            {isThinking && <span className="typing-cursor" />}
          </p>
        ) : !isThinking && (
          <div className="flex items-center justify-center h-full min-h-[60px] text-gray-600 text-xs">
            Waiting for turn…
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ConnectFourGame({ apiKey, models, modelsLoading }) {
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [model1, setModel1] = useState(DEFAULT_MODEL_1)
  const [model2, setModel2] = useState(DEFAULT_MODEL_2)
  const [instructions1, setInstructions1] = useState('')
  const [instructions2, setInstructions2] = useState('')
  const [bet1, setBet1] = useState(null)      // column 1-7 or null
  const [bet2, setBet2] = useState(null)      // column 1-7 or null
  const [moveBet1, setMoveBet1] = useState(null)  // move-count guess or null
  const [moveBet2, setMoveBet2] = useState(null)  // move-count guess or null

  const [board, setBoard] = useState(createBoard)
  const [currentPlayer, setCurrentPlayer] = useState(PLAYER_1)
  const [thinking1, setThinking1] = useState('')
  const [thinking2, setThinking2] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [lastMove, setLastMove] = useState(null)
  const [winningCells, setWinningCells] = useState(null)
  const [winner, setWinner] = useState(null)
  const [gameLog, setGameLog] = useState([])
  const [error, setError] = useState(null)
  const [moveCount, setMoveCount] = useState(0)
  const [lastCol1, setLastCol1] = useState(null)
  const [lastCol2, setLastCol2] = useState(null)
  const [lottieData, setLottieData] = useState(null)
  const [paused, setPaused] = useState(false)

  const gameRunning = useRef(false)
  const pausedRef = useRef(false)
  const logRef = useRef(null)

  // Keep pausedRef in sync with paused state so the async game loop can read it
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Fetch Lottie animation when game ends
  useEffect(() => {
    if (phase === PHASES.GAMEOVER && winner && winner !== 'draw') {
      fetch('https://assets.lottiefiles.com/packages/lf20_touohxv0.json')
        .then(r => r.json())
        .then(setLottieData)
        .catch(() => setLottieData(null))
    }
  }, [phase, winner])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [gameLog])

  function togglePause() {
    setPaused(v => !v)
  }

  function resetGame() {
    gameRunning.current = false
    pausedRef.current = false
    setPaused(false)
    setPhase(PHASES.SETUP)
    setBoard(createBoard())
    setCurrentPlayer(PLAYER_1)
    setThinking1('')
    setThinking2('')
    setIsThinking(false)
    setLastMove(null)
    setWinningCells(null)
    setWinner(null)
    setGameLog([])
    setError(null)
    setMoveCount(0)
    setLastCol1(null)
    setLastCol2(null)
    setLottieData(null)
    setBet1(null)
    setBet2(null)
    setMoveBet1(null)
    setMoveBet2(null)
  }

  async function runGame() {
    if (!apiKey) { setError('Please set your OpenRouter API key first.'); return }

    setPhase(PHASES.PLAYING)
    gameRunning.current = true
    pausedRef.current = false
    setPaused(false)
    setError(null)

    let curBoard = createBoard()
    setBoard(curBoard)
    let player = PLAYER_1
    let moveNum = 0

    while (gameRunning.current) {
      // Wait here if the game is paused (poll every 250ms)
      while (pausedRef.current && gameRunning.current) {
        await new Promise(res => setTimeout(res, 250))
      }
      if (!gameRunning.current) break

      const isP1 = player === PLAYER_1
      const model = isP1 ? model1 : model2
      const instructions = isP1 ? instructions1 : instructions2
      const playerSym = isP1 ? 'R (Red 🔴)' : 'Y (Yellow 🟡)'
      const opponentSym = isP1 ? 'Y (Yellow 🟡)' : 'R (Red 🔴)'

      setCurrentPlayer(player)
      setIsThinking(true)
      if (isP1) { setThinking1(''); setLastCol1(null) }
      else { setThinking2(''); setLastCol2(null) }

      const boardStr = formatBoard(curBoard)
      const validCols = Array.from({ length: COLS }, (_, i) => i)
        .filter(c => curBoard[0][c] === 0)
        .map(c => c + 1)

      const systemPrompt = `You are playing Connect Four. You are ${playerSym}. Your opponent is ${opponentSym}.

Board key: . = empty  R = Red (Player 1)  Y = Yellow (Player 2)
Columns: 1-7 (left→right).  Rows: 1-6 (top→bottom, pieces fall to the bottom).
Available columns to play: ${validCols.join(', ')}.

${instructions ? `Your strategy:\n${instructions}\n` : ''}

Think step-by-step about the best move, then end your response with exactly:
MOVE: <column number>

Pick only from the available columns listed above.`

      const userMsg = `Current board:\n\n${boardStr}\n\nYour turn. Available columns: ${validCols.join(', ')}. What is your move?`

      let fullResponse = ''
      let moveErr = false

      await streamChatCompletion({
        apiKey,
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        maxTokens: 512,
        onChunk: (_, full) => {
          fullResponse = full
          if (isP1) setThinking1(full)
          else setThinking2(full)
        },
        onDone: (full) => { fullResponse = full },
        onError: (err) => {
          setError(`Player ${player} error: ${err.message}`)
          moveErr = true
        },
      })

      setIsThinking(false)
      if (moveErr || !gameRunning.current) break

      // Resolve the column to play
      const rawCol = parseMove(fullResponse)
      const col = pickValidColumn(curBoard, rawCol)

      if (col === -1) {
        setWinner('draw')
        setPhase(PHASES.GAMEOVER)
        break
      }

      const { board: next, row } = dropPiece(curBoard, col, player)
      curBoard = next
      setBoard(next)
      setLastMove({ row, col })
      if (isP1) setLastCol1(col)
      else setLastCol2(col)

      moveNum++
      setMoveCount(moveNum)
      setGameLog(lg => [...lg, `Move ${moveNum}: Player ${player} ${isP1 ? '🔴' : '🟡'} → column ${col + 1}`])

      // Small pause so the piece animation is visible
      await new Promise(res => setTimeout(res, PIECE_DROP_ANIMATION_MS))

      if (checkWinner(next, row, col, player)) {
        setWinningCells(findWinningCells(next, row, col, player))
        await new Promise(res => setTimeout(res, WINNER_ANIMATION_DELAY_MS))
        setWinner(player)
        setPhase(PHASES.GAMEOVER)
        break
      }

      if (isBoardFull(next)) {
        setWinner('draw')
        setPhase(PHASES.GAMEOVER)
        break
      }

      player = player === PLAYER_1 ? PLAYER_2 : PLAYER_1
      await new Promise(res => setTimeout(res, TURN_TRANSITION_MS))
    }

    gameRunning.current = false
  }

  // ── SETUP PHASE ────────────────────────────────────────────────────────────
  if (phase === PHASES.SETUP) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto px-4 pb-12">
        {/* Header */}
        <div className="text-center pt-8 pb-2">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-4xl animate-bounce-in">🔴</span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
              Connect Four
            </h1>
            <span className="text-4xl animate-bounce-in" style={{ animationDelay: '0.1s' }}>🟡</span>
          </div>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Configure two AIs and watch them battle it out on the Connect Four board!
            Each player instructs their AI on how to play, then let the game begin.
          </p>
        </div>

        {/* Player configs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlayerSetup
            player={1} model={model1} onModelChange={setModel1}
            instructions={instructions1} onInstructionsChange={setInstructions1}
            bet={bet1} onBetChange={setBet1} otherBet={bet2}
            moveBet={moveBet1} onMoveBetChange={setMoveBet1} otherMoveBet={moveBet2}
            models={models} modelsLoading={modelsLoading}
          />
          <PlayerSetup
            player={2} model={model2} onModelChange={setModel2}
            instructions={instructions2} onInstructionsChange={setInstructions2}
            bet={bet2} onBetChange={setBet2} otherBet={bet1}
            moveBet={moveBet2} onMoveBetChange={setMoveBet2} otherMoveBet={moveBet1}
            models={models} modelsLoading={modelsLoading}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm flex gap-2">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* Start button */}
        <div className="flex justify-center">
          <button
            onClick={runGame}
            disabled={!apiKey}
            className="px-10 py-4 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400
              hover:from-red-400 hover:via-orange-300 hover:to-yellow-300
              disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
              text-gray-900 font-black text-lg rounded-2xl transition-all duration-200
              shadow-lg hover:shadow-orange-500/30 active:scale-95 animate-bounce-in"
          >
            🎮 Start Game!
          </button>
        </div>

        {!apiKey && (
          <p className="text-center text-yellow-500/70 text-xs">⚠ Enter your OpenRouter API key in the header to start</p>
        )}
      </div>
    )
  }

  // ── GAMEOVER PHASE ─────────────────────────────────────────────────────────
  if (phase === PHASES.GAMEOVER) {
    const winnerName = winner === PLAYER_1 ? 'Player 1 🔴' : winner === PLAYER_2 ? 'Player 2 🟡' : null
    const winnerColor = winner === PLAYER_1
      ? 'from-red-500 via-red-400 to-orange-300'
      : winner === PLAYER_2
        ? 'from-yellow-300 via-yellow-400 to-orange-400'
        : 'from-gray-400 to-gray-300'

    return (
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto px-4 pb-12">
        {/* Winner banner */}
        <div className="text-center pt-8">
          <div className={`inline-block text-5xl md:text-7xl font-black tracking-tight bg-gradient-to-r ${winnerColor} bg-clip-text text-transparent animate-bounce-in`}>
            {winner === 'draw' ? "It's a Draw! 🤝" : `${winnerName} Wins!`}
          </div>
          <p className="text-gray-400 text-sm mt-3">
            Game over in {moveCount} moves
          </p>
        </div>

        {/* Bet Results */}
        {(bet1 !== null || bet2 !== null) && (() => {
          const winCol = winner !== 'draw' && lastMove ? lastMove.col + 1 : null
          const bets = [
            { label: 'Player 1', emoji: '🔴', bet: bet1, isP1: true },
            { label: 'Player 2', emoji: '🟡', bet: bet2, isP1: false },
          ].filter(b => b.bet !== null)

          if (bets.length === 0) return null

          // Closest-column logic (same approach as move-count)
          const diffs = bets.map(b => winCol !== null ? Math.abs(b.bet - winCol) : null)
          const minDiff = winCol !== null ? Math.min(...diffs) : null

          return (
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 text-center">
                💰 Winning Column Bet Results
              </h3>
              <p className="text-center text-xs text-gray-500 mb-4">
                {winCol !== null
                  ? <>Winning column: <span className="text-gray-300 font-bold">col {winCol}</span></>
                  : 'Draw — no winning column'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {bets.map(({ label, emoji, bet }, idx) => {
                  const isVoid = winCol === null
                  const diff = isVoid ? null : diffs[idx]
                  const isWinner = !isVoid && diff === minDiff
                  const isTie = !isVoid && bets.length === 2 && diffs[0] === diffs[1]
                  const isExact = !isVoid && diff === 0

                  let cardIcon, resultText
                  if (isVoid) {
                    cardIcon = '🤷'
                    resultText = <div className="text-xs font-semibold">Void — it&apos;s a draw</div>
                  } else if (isWinner) {
                    cardIcon = isTie ? '🤝' : isExact ? '🎉' : '🏆'
                    const label2 = isTie ? 'Tie!' : isExact ? 'Exact!' : 'Closest!'
                    resultText = (
                      <div className="text-sm font-black text-green-300">
                        {label2} {isExact ? '🎯' : `Off by ${diff}`}
                      </div>
                    )
                  } else {
                    cardIcon = '❌'
                    resultText = (
                      <div className="text-xs font-semibold">
                        Off by {diff} col{diff !== 1 ? 's' : ''}
                      </div>
                    )
                  }

                  return (
                    <div key={label} className={`flex-1 rounded-xl px-5 py-4 text-center border transition-all
                      ${isVoid
                        ? 'bg-gray-800/60 border-gray-600/40 text-gray-400'
                        : isWinner
                          ? 'bg-green-900/40 border-green-500/50 text-green-300 shadow-lg shadow-green-900/30'
                          : 'bg-red-900/30 border-red-600/40 text-red-400'
                      }`}>
                      <div className="text-2xl mb-1">{cardIcon}</div>
                      <div className="font-bold text-sm mb-1">{emoji} {label}</div>
                      <div className="text-xs mb-2 opacity-80">Bet on column <span className="font-bold">{bet}</span></div>
                      {resultText}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Move-count Bet Results */}
        {(moveBet1 !== null || moveBet2 !== null) && (() => {
          const moveBets = [
            { label: 'Player 1', emoji: '🔴', bet: moveBet1, isP1: true },
            { label: 'Player 2', emoji: '🟡', bet: moveBet2, isP1: false },
          ].filter(b => b.bet !== null)

          // Determine which bet(s) are closest to the actual moveCount
          if (moveBets.length === 0) return null
          const diffs = moveBets.map(b => Math.abs(b.bet - moveCount))
          const minDiff = Math.min(...diffs)

          return (
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 text-center">
                🎲 Move Count Bet Results
              </h3>
              <p className="text-center text-xs text-gray-500 mb-4">
                Actual game length: <span className="text-gray-300 font-bold">{moveCount} moves</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {moveBets.map(({ label, emoji, bet, isP1 }, idx) => {
                  const diff = diffs[idx]
                  const isWinner = diff === minDiff
                  const isTie = moveBets.length === 2 && diffs[0] === diffs[1]
                  return (
                    <div key={label} className={`flex-1 rounded-xl px-5 py-4 text-center border transition-all
                      ${isWinner
                        ? 'bg-green-900/40 border-green-500/50 text-green-300 shadow-lg shadow-green-900/30'
                        : 'bg-red-900/30 border-red-600/40 text-red-400'
                      }`}>
                      <div className="text-2xl mb-1">{isWinner ? (isTie ? '🤝' : '🏆') : '❌'}</div>
                      <div className="font-bold text-sm mb-1">{emoji} {label}</div>
                      <div className="text-xs mb-2 opacity-80">
                        Guessed <span className="font-bold">{bet}</span> move{bet !== 1 ? 's' : ''}
                      </div>
                      {isWinner ? (
                        <div className="text-sm font-black text-green-300">
                          {isTie ? 'Tie!' : 'Closest!'} Off by {diff} 🎯
                        </div>
                      ) : (
                        <div className="text-xs font-semibold">
                          Off by {diff} move{diff !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Lottie celebration */}
        {lottieData && winner !== 'draw' && (
          <div className="flex justify-center">
            <div className="w-56 h-56 pointer-events-none select-none">
              <Lottie animationData={lottieData} loop={true} />
            </div>
          </div>
        )}

        {/* Final board */}
        <div className="flex justify-center">
          <ConnectBoard board={board} lastMove={lastMove} winningCells={winningCells} />
        </div>

        {/* Thinking panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ThinkingPanel player={PLAYER_1} model={model1} thinking={thinking1} isThinking={false} lastCol={lastCol1} />
          <ThinkingPanel player={PLAYER_2} model={model2} thinking={thinking2} isThinking={false} lastCol={lastCol2} />
        </div>

        {/* Game log */}
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Game Log</h3>
          <div ref={logRef} className="max-h-40 overflow-y-auto space-y-0.5">
            {gameLog.map((entry, i) => (
              <div key={i} className="text-xs text-gray-400 font-mono">{entry}</div>
            ))}
          </div>
        </div>

        {/* Play again */}
        <div className="flex justify-center">
          <button
            onClick={resetGame}
            className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500
              hover:from-indigo-400 hover:to-purple-400
              text-white font-bold rounded-xl transition-all duration-200
              shadow-lg hover:shadow-purple-500/30 active:scale-95"
          >
            🔄 Play Again
          </button>
        </div>
      </div>
    )
  }

  // ── PLAYING PHASE ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full px-4 pb-12">
      {/* Header */}
      <div className="text-center pt-6 pb-1">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-3xl">🔴</span>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
            Connect Four
          </h1>
          <span className="text-3xl">🟡</span>
        </div>

        {/* Turn indicator + Pause button */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-bold text-sm
            ${paused
              ? 'bg-gray-700/40 border-gray-500/40 text-gray-400'
              : currentPlayer === PLAYER_1
                ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 animate-pulse'}`}>
            {paused ? '⏸' : (currentPlayer === PLAYER_1 ? '🔴' : '🟡')}
            {paused
              ? ' Game paused'
              : isThinking
                ? ` Player ${currentPlayer} is thinking…`
                : ` Player ${currentPlayer}'s turn`}
            {!paused && ` · Move ${moveCount + 1}`}
          </div>

          <button
            onClick={togglePause}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border font-bold text-sm transition-all active:scale-95
              ${paused
                ? 'bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30'
                : 'bg-gray-700/40 border-gray-500/40 text-gray-300 hover:bg-gray-600/40'}`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Full-width: P1 panel | Board | P2 panel */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full max-w-[1400px] mx-auto">
        {/* P1 thinking — fills available space */}
        <div className="flex-1 min-w-0">
          <ThinkingPanel
            player={PLAYER_1} model={model1}
            thinking={thinking1}
            isThinking={isThinking && currentPlayer === PLAYER_1}
            lastCol={lastCol1}
            large
          />
        </div>

        {/* Board — fixed size, centred */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center">
          <ConnectBoard board={board} lastMove={lastMove} winningCells={winningCells} bet1={bet1} bet2={bet2} />
        </div>

        {/* P2 thinking — fills available space */}
        <div className="flex-1 min-w-0">
          <ThinkingPanel
            player={PLAYER_2} model={model2}
            thinking={thinking2}
            isThinking={isThinking && currentPlayer === PLAYER_2}
            lastCol={lastCol2}
            large
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm flex gap-2 max-w-[1400px] mx-auto w-full">
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* Game log */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 max-w-[1400px] mx-auto w-full">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          Game Log · {moveCount} moves
        </h3>
        <div ref={logRef} className="max-h-32 overflow-y-auto space-y-0.5">
          {gameLog.length === 0 && (
            <div className="text-gray-600 text-xs">Game starting…</div>
          )}
          {gameLog.map((entry, i) => (
            <div key={i} className="text-xs text-gray-400 font-mono">{entry}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
