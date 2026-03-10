import {
  doc, collection, setDoc, getDoc, updateDoc,
  onSnapshot, serverTimestamp, query, orderBy, limit, getDocs,
  increment,
} from 'firebase/firestore'
import { db } from '../config/firebase'

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
  await setDoc(doc(db, 'gameState', matchId), {
    board: initialBoard,
    currentPlayer: 1,
    moveLog: [],
    moveCount: 0,
    lastMove: null,
    winningCells: null,
    winner: null,
    isThinking: false,
    thinkingPlayer: null,
    player1LastThinking: '',
    player2LastThinking: '',
    error: null,
  })
  await updateDoc(doc(db, 'matches', matchId), {
    status: 'playing',
    startedAt: serverTimestamp(),
  })
}

export async function updateGameState(matchId, updates) {
  await updateDoc(doc(db, 'gameState', matchId), updates)
}

export function subscribeToGameState(matchId, callback) {
  return onSnapshot(doc(db, 'gameState', matchId), (snap) => {
    if (snap.exists()) callback(snap.data())
    else callback(null)
  })
}

export async function finishMatch(matchId, { winner, winnerUsername, moveCount }) {
  const updates = { winner, winnerUsername, moveCount, status: 'finished', finishedAt: serverTimestamp() }
  await updateDoc(doc(db, 'matches', matchId), updates)

  // Update player stats
  const matchSnap = await getDoc(doc(db, 'matches', matchId))
  const matchData = matchSnap.data()

  if (matchData.player1Uid) {
    const p1Updates = { matchesPlayed: increment(1) }
    if (winner === 'player1') p1Updates.matchesWon = increment(1)
    await updateDoc(doc(db, 'users', matchData.player1Uid), p1Updates)
  }
  if (matchData.player2Uid) {
    const p2Updates = { matchesPlayed: increment(1) }
    if (winner === 'player2') p2Updates.matchesWon = increment(1)
    await updateDoc(doc(db, 'users', matchData.player2Uid), p2Updates)
  }
}

// ─── Admin settings ───────────────────────────────────────────────────────────
export async function getAdminSettings() {
  const snap = await getDoc(doc(db, 'adminSettings', 'config'))
  if (!snap.exists()) return null
  return snap.data()
}

export async function saveAdminSettings(settings) {
  await setDoc(doc(db, 'adminSettings', 'config'), settings, { merge: true })
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
