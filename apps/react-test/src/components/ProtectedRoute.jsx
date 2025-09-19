import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
