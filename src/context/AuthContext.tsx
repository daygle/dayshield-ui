import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getAuthStatus, login, logout } from '../api/auth'
import { setAuthToken, setUnauthorizedHandler } from '../api/client'
import type { AuthUser, LoginRequest } from '../types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (credentials: LoginRequest) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  // Keep a stable ref to signOut so the axios interceptor callback doesn't
  // capture a stale closure.
  const signOutRef = useRef<() => Promise<void>>(async () => {})

  const signOut = useCallback(async () => {
    try {
      await logout()
    } catch {
      // ignore – clear state regardless
    }
    setAuthToken(null)
    setState({ user: null, loading: false })
  }, [])

  // Keep ref in sync
  useEffect(() => {
    signOutRef.current = signOut
  }, [signOut])

  // Register 401 handler so any API call can trigger automatic logout
  useEffect(() => {
    setUnauthorizedHandler(() => signOutRef.current())
    return () => setUnauthorizedHandler(null)
  }, [])

  // Check existing session on mount
  useEffect(() => {
    getAuthStatus()
      .then((res) => {
        if (res.data.authenticated && res.data.username) {
          setState({ user: { username: res.data.username }, loading: false })
        } else {
          setState({ user: null, loading: false })
        }
      })
      .catch(() => {
        setState({ user: null, loading: false })
      })
  }, [])

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const res = await login(credentials)
    if (res.data?.authenticated && res.data?.username) {
      setAuthToken(res.data.token ?? null)
      setState({ user: { username: res.data.username }, loading: false })
    } else {
      throw new Error(res.message ?? 'Login failed')
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
