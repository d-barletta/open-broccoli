// Vercel Serverless Function — returns available OpenRouter models using the
// admin API key stored in Firestore.  The user's browser never needs an API key.
//
// Required environment variable:
//   FIREBASE_SERVICE_ACCOUNT_JSON  — Full JSON of a Firebase service account.

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

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth: require a valid Firebase ID token ──────────────────────────────────
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' })
  }

  let adminApp
  try {
    adminApp = getAdminApp()
  } catch (err) {
    console.error('[models] Firebase Admin init failed:', err.message)
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  try {
    await getAuth(adminApp).verifyIdToken(token)
  } catch (err) {
    console.warn('[models] Token verification failed:', err.code || err.message)
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }

  // ── Fetch admin API key ───────────────────────────────────────────────────────
  const db = getFirestore(adminApp)
  const secretSnap = await db.doc('adminSettings/secret').get()
  const apiKey = secretSnap.data()?.openrouterApiKey

  if (!apiKey) {
    return res.status(503).json({
      error: 'Service not configured. Ask the admin to set an OpenRouter API key in the dashboard.',
    })
  }

  // ── Fetch models from OpenRouter ─────────────────────────────────────────────
  try {
    const response = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = err.error?.message || `OpenRouter API error: ${response.status}`
      return res.status(502).json({ error: msg })
    }

    const data = await response.json()
    return res.status(200).json({ models: data.data || [] })
  } catch (err) {
    console.error('[models] Error fetching models:', err.message)
    return res.status(500).json({ error: 'Failed to fetch models.' })
  }
}
