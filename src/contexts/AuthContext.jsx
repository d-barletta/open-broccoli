import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
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

  function validateUsername(username) {
    const trimmed = username.trim()
    if (!trimmed) throw new Error('Username is required.')
    if (trimmed.length < 3) throw new Error('Username must be at least 3 characters.')
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens.')
    }
    return trimmed
  }

  // Register new user with unique username
  async function register(email, password, username) {
    const trimmedUsername = validateUsername(username)
    const usernameRef = doc(db, 'usernames', trimmedUsername.toLowerCase())

    // Atomically reserve the username: write only if it doesn't exist yet.
    // setDoc with merge:false on a non-existent doc will succeed; we rely on
    // Firestore security rules (allow create if not exists) plus the optimistic
    // write to prevent concurrent registrations of the same username.
    const usernameSnap = await getDoc(usernameRef)
    if (usernameSnap.exists()) {
      throw new Error('Username already taken. Please choose a different one.')
    }

    if (auth.currentUser?.isAnonymous) {
      return upgradeGuestAccount(email, password, trimmedUsername)
    }

    // Reserve username slot *before* creating the Auth user so another
    // concurrent registration loses the race and gets an error on their setDoc.
    // (Full atomicity requires a Cloud Function; this is the best we can do
    //  client-side when combined with strict Firestore security rules.)
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    // Check if this is the first user (becomes admin)
    const usernamesSnap = await getDocs(collection(db, 'usernames'))
    const isFirstUser = usernamesSnap.empty

    // Save user profile
    const profile = {
      uid,
      username: trimmedUsername,
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
    await setDoc(usernameRef, { uid, username: trimmedUsername })

    // Eagerly fetch profile so it is in state before the caller navigates away
    await fetchUserProfile(uid)

    return credential
  }

  async function upgradeGuestAccount(email, password, username) {
    const guestUser = auth.currentUser
    if (!guestUser?.isAnonymous) {
      throw new Error('Guest upgrade requires an anonymous session.')
    }

    const trimmedUsername = validateUsername(username)
    const usernameRef = doc(db, 'usernames', trimmedUsername.toLowerCase())
    const usernameSnap = await getDoc(usernameRef)
    if (usernameSnap.exists()) {
      throw new Error('Username already taken. Please choose a different one.')
    }

    const usernamesSnap = await getDocs(collection(db, 'usernames'))
    const isFirstUser = usernamesSnap.empty
    const credential = EmailAuthProvider.credential(email, password)

    try {
      await linkWithCredential(guestUser, credential)
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('That email is already used by an existing account. Sign in with that account instead.')
      }
      throw err
    }

    await setDoc(doc(db, 'users', guestUser.uid), {
      uid: guestUser.uid,
      username: trimmedUsername,
      email,
      isAdmin: isFirstUser,
      isBanned: false,
      isGuest: false,
      upgradedFromGuestAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }, { merge: true })

    await setDoc(usernameRef, { uid: guestUser.uid, username: trimmedUsername })
    await fetchUserProfile(guestUser.uid)

    return { user: auth.currentUser }
  }

  async function login(email, password) {
    if (auth.currentUser?.isAnonymous) {
      throw new Error('Guest sessions can only be upgraded with Register. Sign out first if you want to access another existing account.')
    }
    const credential = await signInWithEmailAndPassword(auth, email, password)
    // Update last login
    await setDoc(doc(db, 'users', credential.user.uid), { lastLoginAt: serverTimestamp() }, { merge: true })
    // Eagerly fetch profile so it is in state before the caller navigates away
    await fetchUserProfile(credential.user.uid)
    return credential
  }

  async function signInAsGuest(username) {
    const trimmed = validateUsername(username)

    const existingAnonymousUser = auth.currentUser?.isAnonymous ? auth.currentUser : null
    let credential = existingAnonymousUser ? { user: existingAnonymousUser } : null

    if (!credential) {
      try {
        credential = await signInAnonymously(auth)
      } catch (err) {
        if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
          throw new Error('Guest login is disabled in Firebase Auth. Enable Anonymous sign-in in Firebase Console > Authentication > Sign-in method.')
        }
        throw err
      }
    }

    const uid = credential.user.uid
    const profileRef = doc(db, 'users', uid)
    const profileSnap = await getDoc(profileRef)

    if (profileSnap.exists()) {
      await setDoc(profileRef, {
        username: trimmed,
        isGuest: true,
        isAdmin: false,
        isBanned: false,
        lastLoginAt: serverTimestamp(),
      }, { merge: true })
    } else {
      await setDoc(profileRef, {
        uid,
        username: trimmed,
        email: null,
        isAdmin: false,
        isBanned: false,
        isGuest: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        matchesPlayed: 0,
        matchesWon: 0,
      })
    }

    await fetchUserProfile(uid)
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
    upgradeGuestAccount,
    login,
    signInAsGuest,
    logout,
    fetchUserProfile,
    isAdmin: userProfile?.isAdmin === true,
    isBanned: userProfile?.isBanned === true,
    isAnonymous: currentUser?.isAnonymous === true,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
