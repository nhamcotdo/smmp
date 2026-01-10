'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '@/lib/api/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      let response = await fetch('/api/auth/me')

      // If unauthorized, try to refresh token
      if (response.status === 401) {
        const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' })

        if (refreshResponse.ok) {
          // Token refreshed successfully, retry auth check
          response = await fetch('/api/auth/me')
        } else {
          // Refresh failed, clear user
          setUser(null)
          setIsLoading(false)
          return
        }
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setUser(data.data)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string, rememberMe = false) => {
    const { login: loginApi } = await import('@/lib/api/auth')
    const data = await loginApi({ email, password, rememberMe })
    setUser(data.user)
  }

  const register = async (email: string, password: string, name: string) => {
    const { register: registerApi } = await import('@/lib/api/auth')
    const data = await registerApi({ email, password, name })
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
    }
  }

  const refreshUser = async () => {
    await checkAuth()
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
