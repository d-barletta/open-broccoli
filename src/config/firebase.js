import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Firebase configuration
// Copy .env.example to .env.local and fill in your Firebase project credentials.
// See README.md for full setup instructions.
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
const missingKeys = requiredKeys.filter(k => !firebaseConfig[k])
if (missingKeys.length > 0) {
  console.error(
    `[open-broccoli] Missing Firebase environment variables: ${missingKeys.map(k => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', ')}.\n` +
    'Copy .env.example to .env.local and fill in your Firebase project credentials.'
  )
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
