import { createContext, use } from 'react'
import type { LoginInput, RegisterInput } from '@/api/auth'
import type { CurrentUser, Role } from '@/api/types'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: CurrentUser }

export type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<CurrentUser>
  register: (input: RegisterInput) => Promise<CurrentUser>
  logout: () => Promise<void>
  /** Drop the local session without calling the API (e.g. the server already revoked it). */
  clearSession: () => void
  updateUser: (user: CurrentUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

/** The signed-in user. Only call inside routes protected by <RequireAuth>. */
export function useCurrentUser(): CurrentUser {
  const auth = useAuth()
  if (auth.status !== 'authenticated') throw new Error('useCurrentUser called without a signed-in user.')
  return auth.user
}

/** Where each role lands after signing in. */
export const HOME_BY_ROLE: Record<Role, string> = {
  Admin: '/admin',
  Trainer: '/trainer',
  Member: '/member',
}
