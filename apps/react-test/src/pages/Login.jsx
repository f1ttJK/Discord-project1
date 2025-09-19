import React, { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])
  return (
    <div style={{ padding: 24 }}>
      <h1>Вход</h1>
      <p>Авторизуйтесь через Discord, чтобы продолжить.</p>
      <button onClick={login} style={{ padding: '8px 12px', fontSize: 16 }}>
        Войти через Discord
      </button>
    </div>
  )
}
