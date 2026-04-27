import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { constants } from '../env'
import type { Response } from '../types/rpc'
import type { Profile } from '../types/user'

const TOKEN_STORAGE_KEY = 'token'

interface AuthContextValue {
  token: string | null
  profile: Profile | null
  isProfileLoading: boolean
  isInitializing: boolean
  setToken: (token: string | null) => void
  setProfile: (profile: Profile | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileLoading, setProfileLoading] = useState(false)
  const [isInitializing, setInitializing] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_STORAGE_KEY),
  )

  const setToken = useCallback((next: string | null) => {
    setTokenState(next)
    if (next) {
      localStorage.setItem(TOKEN_STORAGE_KEY, next)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }, [])

  const logout = useCallback(() => {
    setProfile(null)
    setToken(null)
  }, [setToken])

  useEffect(() => {
    if (!token) {
      setProfile(null)
      setInitializing(false)
      return
    }

    const controller = new AbortController()
    setProfileLoading(true)
    fetch(`${constants.API_URL}/api/v1/user/profile`, {
      method: 'GET',
      headers: { Auth: token },
      signal: controller.signal,
    })
      .then((res) => res.json() as Promise<Response<Profile>>)
      .then((res) => {
        if (res?.success && res.data) {
          setProfile(res.data)
        } else {
          // Invalid token — clear it so the login modal reappears.
          setToken(null)
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load profile', err)
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setProfileLoading(false)
        setInitializing(false)
      })

    return () => controller.abort()
  }, [token, setToken])

  const value = useMemo<AuthContextValue>(
    () => ({ token, profile, isProfileLoading, isInitializing, setToken, setProfile, logout }),
    [token, profile, isProfileLoading, isInitializing, setToken, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
