// Vercel Serverless Function — fetch OpenRouter credit/key info for admins.
//
// Calls GET /api/v1/auth/key on OpenRouter using the stored API key and returns
// the key metadata (label, usage, limit, rate_limit).  No sensitive key material
// is forwarded to the client.
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

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') {
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
    console.error('[llm-credits] Firebase Admin init failed:', err.message)
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

  // ── Fetch stored API key ──────────────────────────────────────────────────────
  const secretSnap = await db.doc('adminSettings/secret').get()
  const apiKey = secretSnap.data()?.openrouterApiKey
  if (!apiKey) {
    return res.status(503).json({ error: 'No OpenRouter API key configured.' })
  }

  // ── Call OpenRouter /auth/key ─────────────────────────────────────────────────
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: err.error?.message || `OpenRouter returned ${response.status}`,
      })
    }

    const data = await response.json()
    // Forward only the non-sensitive key metadata (no raw key value)
    return res.status(200).json({ data: data.data ?? data })
  } catch (err) {
    console.error('[llm-credits] Fetch error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
