import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '@/api/types'
import { FullPageLoader } from '@/components/ui/Spinner'
import { HOME_BY_ROLE, useAuth } from './authContext'
import { destinationAfterSignIn } from './redirects'

// These guards only decide what the UI shows. The API enforces every permission itself,
// so a user who edits the JavaScript still can't read or change data they don't own.

/** Signed-in users only. Others go to /login and come back here afterwards. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageLoader />
  if (auth.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Only the listed roles; anyone else sees the 403 page. Must be nested inside <RequireAuth>. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return roles.includes(auth.user.role) ? <Outlet /> : <Navigate to="/403" replace />
}

/**
 * Login/register pages. Once the user is signed in (already, or by submitting the form) this guard is the ONE
 * place that redirects them: back to the page that required sign-in, or their dashboard. The pages themselves
 * don't navigate, so two redirects can never race each other.
 */
export function GuestOnly() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageLoader />
  if (auth.status === 'authenticated') return <Navigate to={destinationAfterSignIn(auth.user.role, location.state)} replace />
  return <Outlet />
}

/** "/" → the signed-in user's own dashboard. */
export function HomeRedirect() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <Navigate to={HOME_BY_ROLE[auth.user.role]} replace />
}
