import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, API_BASE } from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const me = await api.me()
        if (!mounted) return
        setUser(me?.user || me || null)
      } catch (e) {
        setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const login = () => {
    // Redirect to API OAuth2 login
    window.location.href = `${API_BASE}/v1/auth/login`
  }

  const logout = async () => {
    try { await api.logout() } catch {}
    // reload to reset state
    window.location.replace('/')
  }

  const value = useMemo(() => ({ user, loading, error, login, logout }), [user, loading, error])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
