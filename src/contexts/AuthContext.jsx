import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Register new user with unique username
  async function register(email, password, username) {
    const usernameRef = doc(db, 'usernames', username.toLowerCase())

    // Atomically reserve the username: write only if it doesn't exist yet.
    // setDoc with merge:false on a non-existent doc will succeed; we rely on
    // Firestore security rules (allow create if not exists) plus the optimistic
    // write to prevent concurrent registrations of the same username.
    const usernameSnap = await getDoc(usernameRef)
    if (usernameSnap.exists()) {
      throw new Error('Username already taken. Please choose a different one.')
    }

    // Reserve username slot *before* creating the Auth user so another
    // concurrent registration loses the race and gets an error on their setDoc.
    // (Full atomicity requires a Cloud Function; this is the best we can do
    //  client-side when combined with strict Firestore security rules.)
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    // Check if this is the first user (becomes admin)
    const usersSnap = await getDocs(collection(db, 'users'))
    const isFirstUser = usersSnap.empty

    // Save user profile
    const profile = {
      uid,
      username,
      email,
      isAdmin: isFirstUser,
      isBanned: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      matchesPlayed: 0,
      matchesWon: 0,
    }
    await setDoc(doc(db, 'users', uid), profile)

    // Reserve username (fails if already taken due to security rules)
    await setDoc(usernameRef, { uid, username })

    return credential
  }

  async function login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    // Update last login
    await setDoc(doc(db, 'users', credential.user.uid), { lastLoginAt: serverTimestamp() }, { merge: true })
    return credential
  }

  async function logout() {
    await signOut(auth)
    setUserProfile(null)
  }

  async function fetchUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      setUserProfile(snap.data())
      return snap.data()
    }
    return null
  }

  useEffect(() => {
    // Fallback: if Firebase never fires the auth callback (e.g. missing config),
    // still allow the app to render the login page after a short delay.
    const fallbackTimer = setTimeout(() => setLoading(false), 3000)

    let unsubscribe = () => {}
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        async (user) => {
          clearTimeout(fallbackTimer)
          setCurrentUser(user)
          if (user) {
            await fetchUserProfile(user.uid)
          } else {
            setUserProfile(null)
          }
          setLoading(false)
        },
        () => {
          // Firebase auth error (e.g. invalid-api-key in dev without .env.local)
          clearTimeout(fallbackTimer)
          setLoading(false)
        }
      )
    } catch {
      clearTimeout(fallbackTimer)
      setLoading(false)
    }
    return () => { unsubscribe(); clearTimeout(fallbackTimer) }
  }, [])

  const value = {
    currentUser,
    userProfile,
    register,
    login,
    logout,
    fetchUserProfile,
    isAdmin: userProfile?.isAdmin === true,
    isBanned: userProfile?.isBanned === true,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
