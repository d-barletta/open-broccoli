// Vercel Serverless Function — delete a user and all their associated data.
//
// Requires a valid Firebase ID token belonging to an admin.
// Deletes: Firebase Auth user, Firestore user doc, username doc(s),
//          all matches, corresponding gameState and matchPrivate docs.
//
// Required environment variable:
//   FIREBASE_SERVICE_ACCOUNT_JSON

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// ─── Firebase Admin init ──────────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.')
  const serviceAccount = JSON.parse(raw)
  return initializeApp({ credential: cert(serviceAccount) })
}

// Commit an array of delete refs in batches of up to 400 to stay within the
// Firestore 500-operation-per-batch limit.
async function batchDelete(db, refs) {
  const CHUNK = 400
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + CHUNK)) {
      batch.delete(ref)
    }
    await batch.commit()
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' })
  }

  let adminApp
  try {
    adminApp = getAdminApp()
  } catch (err) {
    console.error('[delete-user] Firebase Admin init failed:', err.message)
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  let callerUid
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token)
    callerUid = decoded.uid
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }

  const db = getFirestore(adminApp)

  // ── Verify caller is admin ────────────────────────────────────────────────────
  const callerSnap = await db.doc(`users/${callerUid}`).get()
  if (!callerSnap.data()?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required.' })
  }

  // ── Validate target UID ───────────────────────────────────────────────────────
  const { uid: targetUid } = req.body
  if (!targetUid || typeof targetUid !== 'string') {
    return res.status(400).json({ error: 'uid is required.' })
  }
  if (targetUid === callerUid) {
    return res.status(400).json({ error: 'Cannot delete your own account.' })
  }

  try {
    // ── Find all matches belonging to the target user ────────────────────────────
    const matchesRef = db.collection('matches')
    const [p1Snap, p2Snap] = await Promise.all([
      matchesRef.where('player1Uid', '==', targetUid).get(),
      matchesRef.where('player2Uid', '==', targetUid).get(),
    ])

    const matchIds = new Set()
    for (const d of [...p1Snap.docs, ...p2Snap.docs]) {
      matchIds.add(d.id)
    }

    // ── Collect all refs to delete ────────────────────────────────────────────────
    const refsToDelete = []

    for (const matchId of matchIds) {
      refsToDelete.push(db.doc(`matches/${matchId}`))
      refsToDelete.push(db.doc(`gameState/${matchId}`))
      refsToDelete.push(db.doc(`matchPrivate/${matchId}_p1`))
      refsToDelete.push(db.doc(`matchPrivate/${matchId}_p2`))
    }

    // Find and delete username docs for this user
    const usernamesSnap = await db.collection('usernames').where('uid', '==', targetUid).get()
    for (const d of usernamesSnap.docs) {
      refsToDelete.push(d.ref)
    }

    // Delete user Firestore doc
    refsToDelete.push(db.doc(`users/${targetUid}`))

    // ── Commit all deletes in batches ─────────────────────────────────────────────
    await batchDelete(db, refsToDelete)

    // ── Delete Firebase Auth user ─────────────────────────────────────────────────
    // Done last so Firestore cleanup can still run even if Auth deletion fails.
    try {
      await getAuth(adminApp).deleteUser(targetUid)
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        console.warn(`[delete-user] Auth delete failed for ${targetUid}:`, authErr.message)
      }
    }

    return res.status(200).json({ ok: true, matchesDeleted: matchIds.size })
  } catch (err) {
    console.error('[delete-user] Error:', err.message)
    return res.status(500).json({ error: `Failed to delete user: ${err.message}` })
  }
}
