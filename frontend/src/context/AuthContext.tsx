import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api from '../api/client'
import { clearPageCaches, prefetchRoute } from '../lib/pageCache'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const DASH_CACHE_KEY = 'san_dashboard_cache'
const ME_AT_KEY = 'san_me_at'
const ME_TTL_MS = 5 * 60 * 1000

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('san_user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function warmAppChunks(isAdmin: boolean) {
  prefetchRoute(() => import('../pages/DashboardPage'))
  prefetchRoute(() => import('../pages/OrdersPage'))
  prefetchRoute(() => import('../pages/ProfilePage'))
  if (isAdmin) {
    prefetchRoute(() => import('../pages/UsersPage'))
    prefetchRoute(() => import('../pages/ActivityPage'))
    prefetchRoute(() => import('../pages/SettingsPage'))
  }
  // Warm dashboard API in background
  void api.get('/dashboard').then((res) => {
    try {
      sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify(res.data))
    } catch {
      // ignore
    }
  }).catch(() => undefined)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('san_token'))
  const [loading, setLoading] = useState(false)

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('san_token')
    if (!stored) {
      setUser(null)
      setToken(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/me')
      setUser(data.user)
      localStorage.setItem('san_user', JSON.stringify(data.user))
      localStorage.setItem(ME_AT_KEY, String(Date.now()))
    } catch {
      setUser(null)
      setToken(null)
      localStorage.removeItem('san_token')
      localStorage.removeItem('san_user')
      localStorage.removeItem(ME_AT_KEY)
      clearPageCaches()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('san_token')) return
    const last = Number(localStorage.getItem(ME_AT_KEY) || 0)
    const hasUser = Boolean(readStoredUser())
    if (hasUser && Date.now() - last < ME_TTL_MS) {
      return
    }
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/login', { email, password })
    localStorage.setItem('san_token', data.token)
    localStorage.setItem('san_user', JSON.stringify(data.user))
    localStorage.setItem(ME_AT_KEY, String(Date.now()))
    setToken(data.token)
    setUser(data.user)
    setLoading(false)
    // Prefetch pages + dashboard while navigating
    warmAppChunks(Boolean(data.user?.is_super_admin))
  }, [])

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem('san_token')
    localStorage.removeItem('san_token')
    localStorage.removeItem('san_user')
    localStorage.removeItem(ME_AT_KEY)
    clearPageCaches()
    setToken(null)
    setUser(null)
    setLoading(false)
    if (currentToken) {
      void api.post('/logout').catch(() => undefined)
    }
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshUser, setUser }),
    [user, token, loading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { DASH_CACHE_KEY }
