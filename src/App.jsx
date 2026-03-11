import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MatchPage from './pages/MatchPage'
import AdminPage from './pages/AdminPage'
import DashboardPage from './pages/DashboardPage'

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function RegisteredRoute({ children }) {
  const { currentUser, isAnonymous } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (isAnonymous) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { currentUser, isAdmin } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AuthRoute({ children }) {
  const { currentUser, isAnonymous } = useAuth()
  if (currentUser && !isAnonymous) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/" element={<RegisteredRoute><HomePage /></RegisteredRoute>} />
      <Route path="/dashboard" element={<RegisteredRoute><DashboardPage /></RegisteredRoute>} />
      <Route path="/match/:matchId" element={<MatchPage />} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
