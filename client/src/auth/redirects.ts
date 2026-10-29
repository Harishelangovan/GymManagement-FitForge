import type { Location } from 'react-router'
import type { Role } from '@/api/types'
import { HOME_BY_ROLE } from './authContext'

/** Location state set by <RequireAuth> when it sends a visitor to /login. */
export type RedirectState = { from?: Location } | null

/**
 * Where a user goes after signing in: back to the page that asked them to sign in, if that page belongs to
 * their own area (or is /settings); otherwise their dashboard. Never an arbitrary URL, so no open redirect.
 */
export function destinationAfterSignIn(role: Role, state: unknown): string {
  const home = HOME_BY_ROLE[role]
  const from = (state as RedirectState)?.from
  const path = from?.pathname

  if (path && (path.startsWith(home) || path === '/settings')) return path + (from.search ?? '')
  return home
}
