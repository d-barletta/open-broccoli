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
    // Check username uniqueness
    const usernameRef = doc(db, 'usernames', username.toLowerCase())
    const usernameSnap = await getDoc(usernameRef)
    if (usernameSnap.exists()) {
      throw new Error('Username already taken. Please choose a different one.')
    }

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

    // Reserve username
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        await fetchUserProfile(user.uid)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
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
