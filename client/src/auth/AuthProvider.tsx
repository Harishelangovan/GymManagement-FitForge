import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { authApi, type LoginInput, type RegisterInput } from '@/api/auth'
import { onSessionEvent, refreshSession, tokenStore } from '@/api/client'
import type { AuthResponse, CurrentUser } from '@/api/types'
import { AuthContext, type AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  const signIn = useCallback((auth: AuthResponse) => {
    tokenStore.set(auth.accessToken)
    setState({ status: 'authenticated', user: auth.user })
  }, [])

  /** Forget the session locally (token, cached data). Used after logout or when the server ended the session. */
  const clearSession = useCallback(() => {
    tokenStore.clear()
    queryClient.clear() // never show the previous user's cached data to the next one
    setState({ status: 'anonymous', user: null })
  }, [queryClient])

  useEffect(() => {
    let active = true

    // On page load the access token is gone (memory only). Ask for a new one using the HttpOnly cookie.
    // refreshSession() shares one in-flight request, so React StrictMode's double effect is safe.
    refreshSession()
      .then((auth) => active && setState({ status: 'authenticated', user: auth.user }))
      .catch(() => active && setState({ status: 'anonymous', user: null }))

    const unsubscribe = onSessionEvent((event) => {
      if (event.type === 'refreshed') {
        setState({ status: 'authenticated', user: event.auth.user })
      } else {
        clearSession()
        toast.info('Your session has expired. Please sign in again.')
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [clearSession])

  const login = useCallback(async (input: LoginInput) => {
    const auth = await authApi.login(input)
    signIn(auth)
    return auth.user
  }, [signIn])

  const register = useCallback(async (input: RegisterInput) => {
    const auth = await authApi.register(input)
    signIn(auth)
    return auth.user
  }, [signIn])

  const logout = useCallback(async () => {
    try {
      await authApi.logout() // revokes the refresh token server-side and deletes the cookie
    } finally {
      clearSession()
    }
  }, [clearSession])

  const updateUser = useCallback((user: CurrentUser) => {
    setState((current) => (current.status === 'authenticated' ? { ...current, user } : current))
  }, [])

  const value = useMemo(
    () => ({ ...state, login, register, logout, clearSession, updateUser }),
    [state, login, register, logout, clearSession, updateUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
