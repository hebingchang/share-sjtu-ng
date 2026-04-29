import { createContext } from 'react'
import type { Profile } from '../types/user'

export interface AuthContextValue {
  token: string | null
  profile: Profile | null
  isProfileLoading: boolean
  isInitializing: boolean
  setToken: (token: string | null) => void
  setProfile: (profile: Profile | null) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
