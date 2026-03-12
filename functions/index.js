import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

if (!getApps().length) initializeApp()

// ─── Constants ────────────────────────────────────────────────────────────────
const ROWS = 6
const COLS = 7
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// Write streaming text to Firestore at most once per this interval (ms)
const STREAM_WRITE_INTERVAL_MS = 800

function decodeBoard(storedBoard) {
  if (!Array.isArray(storedBoard)) return storedBoard
  if (storedBoard.length === 0) return storedBoard
  if (Array.isArray(storedBoard[0])) return storedBoard
  if (storedBoard[0] && typeof storedBoard[0] === 'object' && Array.isArray(storedBoard[0].cells)) {
    return storedBoard.map(row => row.cells)
  }
  return storedBoard
}

function encodeBoard(board) {
  if (!Array.isArray(board)) return board
  return board.map(row => ({ cells: Array.isArray(row) ? row : [] }))
}

function encodeWinningCells(cells) {
  if (!Array.isArray(cells)) return cells
  return cells.map(([row, col]) => ({ row, col }))
}

// ─── Board helpers ────────────────────────────────────────────────────────────
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
  const tagged = text.match(/MOVE\s*:\s*([1-7])/i)
  if (tagged) return parseInt(tagged[1]) - 1
  const nums = [...text.matchAll(/\b([1-7])\b/g)]
  if (nums.length > 0) return parseInt(nums[nums.length - 1][1]) - 1
  return -1
}

function pickValidColumn(board, preferred) {
  if (preferred >= 0 && preferred < COLS && board[0][preferred] === 0) return preferred
  for (let d = 1; d < COLS; d++) {
    for (const sign of [1, -1]) {
      const c = preferred + sign * d
      if (c >= 0 && c < COLS && board[0][c] === 0) return c
    }
  }
  return -1
}

// ─── OpenRouter streaming call ────────────────────────────────────────────────
async function callOpenRouter({ apiKey, model, systemPrompt, userMsg, gsRef }) {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'open-broccoli Connect 4',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 512,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenRouter API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let lastWrite = Date.now()
  let usageCaptured = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue
      try {
        const json = JSON.parse(trimmed.slice(6))
        if (json.usage) usageCaptured = json.usage
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          fullContent += delta
          const now = Date.now()
          if (now - lastWrite >= STREAM_WRITE_INTERVAL_MS) {
            lastWrite = now
            // Non-blocking write — don't await to keep streaming fast
            gsRef.update({ currentThinkingText: fullContent }).catch(() => {})
          }
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return { fullContent, usage: usageCaptured }
}

// Encode a model ID for use as a Firestore document ID (/ is not allowed).
function encodeModelForFirestore(model) {
  return model.replace(/\//g, '__')
}

// Write per-call token usage to the llmStats collection (best-effort).
async function recordLlmUsage(db, model, usage) {
  if (!usage) return
  const promptTokens = usage.prompt_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? 0
  const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens)
  const encodedModel = encodeModelForFirestore(model)
  try {
    const batch = db.batch()
    batch.set(db.doc('adminSettings/llmStats'), {
      totalCalls: FieldValue.increment(1),
      totalPromptTokens: FieldValue.increment(promptTokens),
      totalCompletionTokens: FieldValue.increment(completionTokens),
      totalTokens: FieldValue.increment(totalTokens),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    batch.set(db.doc(`llmStats/${encodedModel}`), {
      model,
      calls: FieldValue.increment(1),
      promptTokens: FieldValue.increment(promptTokens),
      completionTokens: FieldValue.increment(completionTokens),
      totalTokens: FieldValue.increment(totalTokens),
    }, { merge: true })
    await batch.commit()
  } catch (err) {
    console.warn('[cf] Failed to record LLM usage:', err.message)
  }
}

// ─── Player stats helper ──────────────────────────────────────────────────────
async function updatePlayerStats(db, matchId, winnerPlayerNum) {
  try {
    const matchRef = db.doc(`matches/${matchId}`)
    await db.runTransaction(async (tx) => {
      const matchSnap = await tx.get(matchRef)
      const matchData = matchSnap.data()
      if (!matchData) return

      // Idempotency guard: retries or concurrent workers must not double-count stats.
      if (matchData.statsApplied === true) return

      if (matchData.player1Uid) {
        const ref = db.doc(`users/${matchData.player1Uid}`)
        const updates = { matchesPlayed: FieldValue.increment(1) }
        if (winnerPlayerNum === 1) updates.matchesWon = FieldValue.increment(1)
        tx.set(ref, updates, { merge: true })
      }
      if (matchData.player2Uid) {
        const ref = db.doc(`users/${matchData.player2Uid}`)
        const updates = { matchesPlayed: FieldValue.increment(1) }
        if (winnerPlayerNum === 2) updates.matchesWon = FieldValue.increment(1)
        tx.set(ref, updates, { merge: true })
      }

      tx.update(matchRef, {
        statsApplied: true,
        statsAppliedAt: FieldValue.serverTimestamp(),
      })
    })
  } catch (err) {
    // Stats update is best-effort; log for observability but don't break the game flow
    console.warn(`[processAiMove] Stats update failed for match ${matchId}:`, err.message)
  }
}

// ─── Main Cloud Function ──────────────────────────────────────────────────────
// Triggered whenever the gameState document for a match is created or updated.
// Only proceeds when pendingAiMove === true (prevents infinite re-triggers).
export const processAiMove = onDocumentWritten(
  { document: 'gameState/{matchId}', timeoutSeconds: 60, region: 'us-central1' },
  async (event) => {
    const after = event.data?.after?.data()
    if (!after) return                    // Document deleted — ignore
    if (!after.pendingAiMove) return      // Nothing to do
    if (after.winner !== null) return     // Game already over

    const { matchId } = event.params
    const db = getFirestore()
    const gsRef = db.doc(`gameState/${matchId}`)

    // ── Atomically claim this move to prevent duplicate processing ──────────
    let claimedState = null
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(gsRef)
        const gs = snap.data()
        if (!gs?.pendingAiMove || gs?.isThinking || gs?.winner !== null) {
          throw new Error('not_needed')
        }
        tx.update(gsRef, {
          pendingAiMove: false,
          isThinking: true,
          thinkingPlayer: gs.currentPlayer,
          currentThinkingText: '',
          error: null,
        })
        claimedState = gs
      })
    } catch (err) {
      // 'not_needed' is the expected path when another invocation already claimed the move.
      // Any other error is unexpected — log it for debugging.
      if (err.message !== 'not_needed') {
        console.error(`[processAiMove] Transaction failed for match ${matchId}:`, err)
      }
      return // Another invocation already claimed this move
    }

    if (!claimedState) return

    const playerNum = claimedState.currentPlayer
    const board = decodeBoard(claimedState.board)

    // Prevent stale workers from overwriting a newer board state.
    async function guardedGameStateUpdate(updates) {
      return db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(gsRef)
        const fresh = freshSnap.data()
        if (!fresh) return false

        const sameTurn = fresh.moveCount === claimedState.moveCount
          && fresh.pendingAiMove === false
          && fresh.isThinking === true
          && fresh.thinkingPlayer === playerNum
          && fresh.winner === null

        if (!sameTurn) return false
        tx.update(gsRef, updates)
        return true
      })
    }

    // ── Fetch admin API key (Admin SDK bypasses security rules) ─────────────
    const secretSnap = await db.doc('adminSettings/secret').get()
    const apiKey = secretSnap.data()?.openrouterApiKey

    if (!apiKey) {
      await gsRef.update({
        isThinking: false,
        thinkingPlayer: null,
        currentThinkingText: '',
        error: 'No OpenRouter API key configured. Ask the admin to set one in the dashboard.',
      })
      return
    }

    // ── Fetch the current player's private config ────────────────────────────
    const configSnap = await db.doc(`matchPrivate/${matchId}_p${playerNum}`).get()
    const config = configSnap.data()

    if (!config) {
      await gsRef.update({
        isThinking: false,
        thinkingPlayer: null,
        currentThinkingText: '',
        error: `Player ${playerNum} configuration not found.`,
      })
      return
    }

    // ── Resolve model (respect forceSameModel and useOpenRouterFree) ─────────
    const publicSettingsSnap = await db.doc('adminSettings/public').get()
    const publicSettings = publicSettingsSnap.data() || {}
    const forceSameModel = publicSettings.forceSameModel === true
    const forcedModel = publicSettings.forcedModel
    const useOpenRouterFree = publicSettings.useOpenRouterFree === true

    let modelToUse = (forceSameModel && forcedModel) ? forcedModel : config.model
    // Apply free mode: route all calls through openrouter/free when enabled.
    if (useOpenRouterFree) modelToUse = 'openrouter/free'

    if (!modelToUse) {
      await gsRef.update({
        isThinking: false,
        thinkingPlayer: null,
        currentThinkingText: '',
        error: 'No model configured for this player. Ask the admin to set a valid model.',
      })
      return
    }

    // ── Build AI prompt ──────────────────────────────────────────────────────
    const isP1 = playerNum === 1
    const playerSym = isP1 ? 'R (Red 🔴)' : 'Y (Yellow 🟡)'
    const opponentSym = isP1 ? 'Y (Yellow 🟡)' : 'R (Red 🔴)'
    const validCols = Array.from({ length: COLS }, (_, i) => i)
      .filter(c => board[0][c] === 0).map(c => c + 1)

    const systemPrompt = `You are playing Connect Four. You are ${playerSym}. Your opponent is ${opponentSym}.

Board key: . = empty  R = Red (Player 1)  Y = Yellow (Player 2)
Columns: 1-7 (left→right).  Rows: 1-6 (top→bottom, pieces fall to the bottom).
Available columns to play: ${validCols.join(', ')}.
${config.instructions ? `\nYour strategy:\n${config.instructions}\n` : ''}
Think step-by-step about the best move, then end your response with exactly:
MOVE: <column number>

Pick only from the available columns listed above.`

    const userMsg = `Current board:\n\n${formatBoard(board)}\n\nYour turn. Available columns: ${validCols.join(', ')}. What is your move?`

    // ── Call OpenRouter (streaming) ──────────────────────────────────────────
    let fullResponse = ''
    const thinkingKey = `player${playerNum}LastThinking`

    try {
      const llmResponse = await callOpenRouter({
        apiKey,
        model: modelToUse,
        systemPrompt,
        userMsg,
        gsRef,
      })
      fullResponse = llmResponse.fullContent
      recordLlmUsage(db, modelToUse, llmResponse.usage).catch(() => {})
    } catch (err) {
      await gsRef.update({
        isThinking: false,
        thinkingPlayer: null,
        currentThinkingText: '',
        [thinkingKey]: fullResponse || '',
        error: `Player ${playerNum} AI error: ${err.message}`,
      })
      return
    }

    // ── Resolve move ─────────────────────────────────────────────────────────
    const rawCol = parseMove(fullResponse)
    const col = pickValidColumn(board, rawCol)

    if (col === -1) {
      // Board is completely full — genuine draw
      const applied = await guardedGameStateUpdate({
        winner: 'draw',
        isThinking: false,
        thinkingPlayer: null,
        pendingAiMove: false,
        [thinkingKey]: fullResponse,
        currentThinkingText: '',
      })
      if (!applied) return
      await db.doc(`matches/${matchId}`).update({
        winner: 'draw',
        winnerUsername: null,
        moveCount: claimedState.moveCount,
        status: 'finished',
        finishedAt: FieldValue.serverTimestamp(),
      })
      await updatePlayerStats(db, matchId, null)
      return
    }

    const { board: nextBoard, row } = dropPiece(board, col, playerNum)
    const newMoveCount = claimedState.moveCount + 1
    const newMoveLog = [
      ...(claimedState.moveLog || []),
      `Move ${newMoveCount}: Player ${playerNum} ${isP1 ? '🔴' : '🟡'} → column ${col + 1}`,
    ]

    // ── Check win ────────────────────────────────────────────────────────────
    if (checkWinner(nextBoard, row, col, playerNum)) {
      const winCells = findWinningCells(nextBoard, row, col, playerNum)
      const applied = await guardedGameStateUpdate({
        board: encodeBoard(nextBoard),
        lastMove: { row, col },
        moveLog: newMoveLog,
        moveCount: newMoveCount,
        winningCells: encodeWinningCells(winCells),
        winner: playerNum,
        isThinking: false,
        thinkingPlayer: null,
        pendingAiMove: false,
        [thinkingKey]: fullResponse,
        currentThinkingText: '',
      })
      if (!applied) return
      const matchSnap = await db.doc(`matches/${matchId}`).get()
      const matchData = matchSnap.data()
      const winnerUsername = playerNum === 1 ? matchData.player1Username : matchData.player2Username
      await db.doc(`matches/${matchId}`).update({
        winner: `player${playerNum}`,
        winnerUsername,
        moveCount: newMoveCount,
        status: 'finished',
        finishedAt: FieldValue.serverTimestamp(),
      })
      await updatePlayerStats(db, matchId, playerNum)
      return
    }

    // ── Check draw (full board) ──────────────────────────────────────────────
    if (isBoardFull(nextBoard)) {
      const applied = await guardedGameStateUpdate({
        board: encodeBoard(nextBoard),
        lastMove: { row, col },
        moveLog: newMoveLog,
        moveCount: newMoveCount,
        winner: 'draw',
        isThinking: false,
        thinkingPlayer: null,
        pendingAiMove: false,
        [thinkingKey]: fullResponse,
        currentThinkingText: '',
      })
      if (!applied) return
      await db.doc(`matches/${matchId}`).update({
        winner: 'draw',
        winnerUsername: null,
        moveCount: newMoveCount,
        status: 'finished',
        finishedAt: FieldValue.serverTimestamp(),
      })
      await updatePlayerStats(db, matchId, null)
      return
    }

    // ── Continue game: hand off to next player ───────────────────────────────
    const nextPlayer = playerNum === 1 ? 2 : 1
    const applied = await guardedGameStateUpdate({
      board: encodeBoard(nextBoard),
      currentPlayer: nextPlayer,
      lastMove: { row, col },
      moveLog: newMoveLog,
      moveCount: newMoveCount,
      isThinking: false,
      thinkingPlayer: null,
      pendingAiMove: true,     // Triggers the next Cloud Function invocation
      [thinkingKey]: fullResponse,
      currentThinkingText: '',
    })
    if (!applied) return
  }
)
