import {
  doc, collection, setDoc, getDoc, updateDoc, runTransaction,
  onSnapshot, serverTimestamp, query, orderBy, limit, getDocs, where,
} from 'firebase/firestore'
import { db } from '../config/firebase'

function encodeBoard(board) {
  if (!Array.isArray(board)) return board
  return board.map(row => ({ cells: Array.isArray(row) ? row : [] }))
}

function decodeBoard(storedBoard) {
  if (!Array.isArray(storedBoard)) return storedBoard
  if (storedBoard.length === 0) return storedBoard
  if (Array.isArray(storedBoard[0])) return storedBoard
  if (storedBoard[0] && typeof storedBoard[0] === 'object' && Array.isArray(storedBoard[0].cells)) {
    return storedBoard.map(row => row.cells)
  }
  return storedBoard
}

function encodeWinningCells(cells) {
  if (!Array.isArray(cells)) return cells
  return cells.map(([row, col]) => ({ row, col }))
}

function decodeWinningCells(storedCells) {
  if (!Array.isArray(storedCells)) return storedCells
  if (storedCells.length === 0) return storedCells
  if (Array.isArray(storedCells[0])) return storedCells
  if (
    storedCells[0]
    && typeof storedCells[0] === 'object'
    && Number.isInteger(storedCells[0].row)
    && Number.isInteger(storedCells[0].col)
  ) {
    return storedCells.map(cell => [cell.row, cell.col])
  }
  return storedCells
}

// ─── ID generator ─────────────────────────────────────────────────────────────
function generateMatchId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

async function generateUniqueMatchId(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const id = generateMatchId()
    const snap = await getDoc(doc(db, 'matches', id))
    if (!snap.exists()) return id
  }
  throw new Error('Failed to generate a unique match ID. Please try again.')
}

// ─── Matches ──────────────────────────────────────────────────────────────────
export async function createMatch(player1Uid, player1Username) {
  const matchId = await generateUniqueMatchId()
  const matchRef = doc(db, 'matches', matchId)
  await setDoc(matchRef, {
    id: matchId,
    status: 'waiting_p2',
    player1Uid,
    player1Username,
    player1Ready: false,
    player2Uid: null,
    player2Username: null,
    player2Ready: false,
    winner: null,
    winnerUsername: null,
    moveCount: null,
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
    player1Model: null,
    player2Model: null,
    player1ColumnBet: null,
    player2ColumnBet: null,
    player1MoveBet: null,
    player2MoveBet: null,
  })
  return matchId
}

export async function joinMatch(matchId, player2Uid, player2Username) {
  const matchRef = doc(db, 'matches', matchId)
  const snap = await getDoc(matchRef)
  if (!snap.exists()) throw new Error('Match not found.')
  const data = snap.data()
  if (data.status !== 'waiting_p2') throw new Error('This match has already started or is full.')
  if (data.player1Uid === player2Uid) throw new Error('You cannot join your own match.')

  await updateDoc(matchRef, {
    player2Uid,
    player2Username,
    status: 'setup',
  })
}

export async function getMatch(matchId) {
  const snap = await getDoc(doc(db, 'matches', matchId))
  if (!snap.exists()) return null
  return snap.data()
}

export function subscribeToMatch(matchId, callback) {
  return onSnapshot(doc(db, 'matches', matchId), (snap) => {
    if (snap.exists()) callback(snap.data())
    else callback(null)
  })
}

export async function setPlayerReady(matchId, playerNum, { model, columnBet, moveBet }) {
  const updates = {}
  updates[`player${playerNum}Ready`] = true
  updates[`player${playerNum}Model`] = model
  updates[`player${playerNum}ColumnBet`] = columnBet
  updates[`player${playerNum}MoveBet`] = moveBet
  await updateDoc(doc(db, 'matches', matchId), updates)
}

export async function setPlayerNotReady(matchId, playerNum) {
  const updates = {}
  updates[`player${playerNum}Ready`] = false
  await updateDoc(doc(db, 'matches', matchId), updates)
}

// ─── Private player configs ───────────────────────────────────────────────────
export async function savePrivateConfig(matchId, playerNum, uid, config) {
  const docId = `${matchId}_p${playerNum}`
  await setDoc(doc(db, 'matchPrivate', docId), { uid, ...config })
}

export async function getPrivateConfig(matchId, playerNum) {
  const snap = await getDoc(doc(db, 'matchPrivate', `${matchId}_p${playerNum}`))
  if (!snap.exists()) return null
  return snap.data()
}

// ─── Game state ───────────────────────────────────────────────────────────────
export async function initGameState(matchId, initialBoard) {
  const matchRef = doc(db, 'matches', matchId)
  const gsRef = doc(db, 'gameState', matchId)

  return runTransaction(db, async (tx) => {
    const [matchSnap, gsSnap] = await Promise.all([
      tx.get(matchRef),
      tx.get(gsRef),
    ])

    if (!matchSnap.exists()) {
      throw new Error('Match not found.')
    }

    const match = matchSnap.data()
    if (match.status !== 'setup' || !match.player1Ready || !match.player2Ready) {
      return false
    }

    // If game state already exists, another client/tab already started the game.
    if (gsSnap.exists()) {
      return false
    }

    tx.set(gsRef, {
      board: encodeBoard(initialBoard),
      currentPlayer: 1,
      moveLog: [],
      moveCount: 0,
      lastMove: null,
      winningCells: null,
      winner: null,
      isThinking: false,
      thinkingPlayer: null,
      // pendingAiMove=true signals the server-side AI handler to begin processing.
      // Vercel: the browser detects this and calls /api/ai-move.
      // Firebase CF: the Firestore document trigger fires automatically.
      pendingAiMove: true,
      currentThinkingText: '',
      player1LastThinking: '',
      player2LastThinking: '',
      error: null,
    })

    tx.update(matchRef, {
      status: 'playing',
      startedAt: serverTimestamp(),
    })

    return true
  })
}

export async function updateGameState(matchId, updates) {
  const safeUpdates = { ...updates }
  if (Object.prototype.hasOwnProperty.call(safeUpdates, 'board')) {
    safeUpdates.board = encodeBoard(safeUpdates.board)
  }
  if (Object.prototype.hasOwnProperty.call(safeUpdates, 'winningCells')) {
    safeUpdates.winningCells = encodeWinningCells(safeUpdates.winningCells)
  }
  await updateDoc(doc(db, 'gameState', matchId), safeUpdates)
}

export function subscribeToGameState(matchId, callback) {
  return onSnapshot(doc(db, 'gameState', matchId), (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      callback({
        ...data,
        board: decodeBoard(data.board),
        winningCells: decodeWinningCells(data.winningCells),
      })
    }
    else callback(null)
  })
}

// NOTE: finishMatch (match status + player stats) is handled server-side by the
// AI backend (api/ai-move.js for Vercel, or functions/index.js for Firebase CF),
// which uses the Firebase Admin SDK to write without client-permission checks.

// ─── Admin settings ───────────────────────────────────────────────────────────
// adminSettings/public — available models list (readable by all authenticated users)
// adminSettings/secret — OpenRouter API key (readable only by admins and Cloud Functions)

export async function getAdminPublicSettings() {
  const snap = await getDoc(doc(db, 'adminSettings', 'public'))
  if (!snap.exists()) return null
  return snap.data()
}

export async function saveAdminPublicSettings(settings) {
  await setDoc(doc(db, 'adminSettings', 'public'), settings, { merge: true })
}

export async function getAdminSecretSettings() {
  // Security rules restrict this to admin users; Cloud Functions use Admin SDK (bypasses rules)
  const snap = await getDoc(doc(db, 'adminSettings', 'secret'))
  if (!snap.exists()) return null
  return snap.data()
}

export async function saveAdminSecretSettings(settings) {
  await setDoc(doc(db, 'adminSettings', 'secret'), settings, { merge: true })
}

// ─── Admin: users list ────────────────────────────────────────────────────────
export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data())
}

export async function updateUserAdmin(uid, updates) {
  await updateDoc(doc(db, 'users', uid), updates)
}

// ─── Admin: match stats ───────────────────────────────────────────────────────
export async function getAllMatches(limitCount = 50) {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(limitCount)))
  return snap.docs.map(d => d.data())
}

export async function getUserMatches(uid, limitCount = 50) {
  const matchesRef = collection(db, 'matches')
  const [player1Snap, player2Snap] = await Promise.all([
    getDocs(query(matchesRef, where('player1Uid', '==', uid))),
    getDocs(query(matchesRef, where('player2Uid', '==', uid))),
  ])

  const deduped = new Map()

  for (const snap of [...player1Snap.docs, ...player2Snap.docs]) {
    const data = snap.data()
    deduped.set(data.id || snap.id, data)
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      const leftTime = left.createdAt?.seconds || 0
      const rightTime = right.createdAt?.seconds || 0
      return rightTime - leftTime
    })
    .slice(0, limitCount)
}
