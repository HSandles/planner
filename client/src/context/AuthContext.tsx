import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types2'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// The context starts as null — we'll throw if it's used outside the provider
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // On app load, check if there's a valid session cookie already
  // This keeps the user logged in across page refreshes
  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then((data: User | null) => {
        setUser(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })

    if (!res.ok) {
      const err = await res.json() as { error: string }
      throw new Error(err.error)
    }

    const data: User = await res.json()
    setUser(data)
  }

  const register = async (email: string, password: string): Promise<void> => {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })

    if (!res.ok) {
      const err = await res.json() as { error: string }
      throw new Error(err.error)
    }

    const data: User = await res.json()
    setUser(data)
  }

  const logout = async (): Promise<void> => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — components call useAuth() instead of useContext(AuthContext)
// The null check means we get a clear error if it's used outside AuthProvider
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}