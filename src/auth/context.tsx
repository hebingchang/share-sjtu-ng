import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'
import { constants } from '../env'
import type { Response } from '../types/rpc'
import type { Profile } from '../types/user'

const TOKEN_STORAGE_KEY = 'token'

function readStoredToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(readStoredToken)
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [isProfileLoading, setProfileLoading] = useState(() => !!readStoredToken())
  const [isInitializing, setInitializing] = useState(() => !!readStoredToken())

  const setProfile = useCallback((next: Profile | null) => {
    setProfileState(next)
  }, [])

  const setToken = useCallback((next: string | null) => {
    setTokenState(next)
    if (next) {
      localStorage.setItem(TOKEN_STORAGE_KEY, next)
      setProfileState(null)
      setProfileLoading(true)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      setProfileState(null)
      setProfileLoading(false)
      setInitializing(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
  }, [setToken])

  useEffect(() => {
    if (!token) {
      return
    }

    const controller = new AbortController()
    fetch(`${constants.API_URL}/api/v1/user/profile`, {
      method: 'GET',
      headers: { Auth: token },
      signal: controller.signal,
    })
      .then((res) => res.json() as Promise<Response<Profile>>)
      .then((res) => {
        if (res?.success && res.data) {
          setProfileState(res.data)
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
    [token, profile, isProfileLoading, isInitializing, setToken, setProfile, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
