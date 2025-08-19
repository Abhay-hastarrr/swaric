import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AuthAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    AuthAPI.me()
      .then((u) => {
        if (isMounted) setUser(u)
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  async function signup(data) {
    setError('')
    const u = await AuthAPI.signup(data)
    setUser(u)
    return u
  }

  async function login(data) {
    setError('')
    const u = await AuthAPI.login(data)
    setUser(u)
    return u
  }

  async function logout() {
    await AuthAPI.logout()
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, error, setError, signup, login, logout }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


