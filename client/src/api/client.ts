import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toApiError } from './errors'
import type { AuthResponse } from './types'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Required by the API on cookie-authenticated endpoints (/auth/refresh, /auth/logout) as CSRF protection. */
export const CLIENT_HEADER = { 'X-FitForge-Client': 'web' } as const

// ---------------------------------------------------------------------------------------------
// Access token storage: a plain module variable (memory only).
// Never localStorage/sessionStorage, which any injected script could read and which survive the tab.
// After a page reload the token is gone, and the app gets a new one from the HttpOnly refresh cookie.
// ---------------------------------------------------------------------------------------------
let accessToken: string | null = null

export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token
  },
  clear: () => {
    accessToken = null
  },
}

// Session events, so the AuthProvider learns when a background refresh succeeds or the session ends.
type SessionEvent = { type: 'refreshed'; auth: AuthResponse } | { type: 'expired' }
const listeners = new Set<(event: SessionEvent) => void>()

export function onSessionEvent(listener: (event: SessionEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const emit = (event: SessionEvent) => listeners.forEach((listener) => listener(event))

// ---------------------------------------------------------------------------------------------
// Refresh: at most ONE request in flight. The API rotates the refresh token on every call and treats
// reuse of an old token as theft, so two parallel refreshes (two failing requests, React StrictMode,
// two tabs) must share a single request instead of racing each other.
// ---------------------------------------------------------------------------------------------
let refreshInFlight: Promise<AuthResponse> | null = null

export function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= axios
    .post<AuthResponse>(`${baseURL}/auth/refresh`, null, { withCredentials: true, headers: CLIENT_HEADER })
    .then((response) => {
      tokenStore.set(response.data.accessToken)
      emit({ type: 'refreshed', auth: response.data })
      return response.data
    })
    .catch((error: unknown) => {
      tokenStore.clear()
      throw toApiError(error)
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

// ---------------------------------------------------------------------------------------------
// The API client used everywhere else.
// ---------------------------------------------------------------------------------------------
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Endpoints where a 401 means "wrong credentials / bad link", not "access token expired".
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error)
    const config = (error as { config?: RetriableConfig }).config

    const canRefresh =
      apiError.status === 401 && config && !config._retried && !NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path))

    if (canRefresh) {
      config._retried = true
      try {
        await refreshSession()
        return api(config) // retry once with the new access token
      } catch {
        emit({ type: 'expired' })
      }
    }

    return Promise.reject(apiError)
  },
)
