import { createBrowserRouter, type RouteObject } from 'react-router'
import type { Role } from '@/api/types'
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from '@/auth/guards'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/auth/PasswordRecoveryPages'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ComingSoonPage, ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/pages/errors/StatusPages'
import { NAVIGATION } from './navigation'

// Signed-in pages are code-split: each dashboard (and the charting library) downloads only when it's opened,
// so the sign-in screens load fast. The auth pages stay in the main bundle because they're the first thing shown.
const DASHBOARDS: Record<Role, RouteObject['lazy']> = {
  Admin: async () => ({ Component: (await import('@/pages/dashboards/AdminDashboard')).AdminDashboard }),
  Trainer: async () => ({ Component: (await import('@/pages/dashboards/TrainerDashboard')).TrainerDashboard }),
  Member: async () => ({ Component: (await import('@/pages/dashboards/MemberDashboard')).MemberDashboard }),
}

/** One protected area per role: its dashboard plus every page listed in the sidebar. */
function roleArea(role: Role): RouteObject {
  const [home, ...pages] = NAVIGATION[role]
  return {
    element: <RequireRole roles={[role]} />,
    children: [
      { path: home.path, lazy: DASHBOARDS[role] },
      ...pages.map((page) => ({ path: page.path, element: <ComingSoonPage title={page.label} phase={page.phase} /> })),
    ],
  }
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      // Signed-out pages
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <RegisterPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      // Reset links are opened from email and work whether or not someone is signed in on this browser.
      { element: <AuthLayout />, children: [{ path: '/reset-password', element: <ResetPasswordPage /> }] },

      // Signed-in app
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          {
            element: <AppShell />,
            children: [
              roleArea('Admin'),
              roleArea('Trainer'),
              roleArea('Member'),
              { path: '/settings', lazy: async () => ({ Component: (await import('@/pages/account/SettingsPage')).SettingsPage }) },
              { path: '/403', element: <ForbiddenPage /> },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
