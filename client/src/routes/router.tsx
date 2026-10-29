import { createBrowserRouter, type RouteObject } from 'react-router'
import type { Role } from '@/api/types'
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from '@/auth/guards'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/auth/PasswordRecoveryPages'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/pages/errors/StatusPages'

type Lazy = NonNullable<RouteObject['lazy']>

// Every signed-in page is code-split: it downloads the first time it's opened. The sign-in pages stay in
// the main bundle because they're the first thing a visitor sees.
const page = {
  adminDashboard: async () => ({ Component: (await import('@/pages/dashboards/AdminDashboard')).AdminDashboard }),
  trainerDashboard: async () => ({ Component: (await import('@/pages/dashboards/TrainerDashboard')).TrainerDashboard }),
  memberDashboard: async () => ({ Component: (await import('@/pages/dashboards/MemberDashboard')).MemberDashboard }),
  members: async () => ({ Component: (await import('@/pages/people/MembersPage')).MembersPage }),
  memberDetail: async () => ({ Component: (await import('@/pages/people/MemberDetailPage')).MemberDetailPage }),
  trainers: async () => ({ Component: (await import('@/pages/people/TrainersPage')).TrainersPage }),
  plans: async () => ({ Component: (await import('@/pages/billing/PlansPage')).PlansPage }),
  memberships: async () => ({ Component: (await import('@/pages/billing/MembershipsPage')).MembershipsPage }),
  payments: async () => ({ Component: (await import('@/pages/billing/PaymentsPage')).PaymentsPage }),
  classes: async () => ({ Component: (await import('@/pages/classes/ClassesPage')).ClassesPage }),
  attendance: async () => ({ Component: (await import('@/pages/classes/AttendancePage')).AttendancePage }),
  auditLog: async () => ({ Component: (await import('@/pages/admin/AuditLogPage')).AuditLogPage }),
  workouts: async () => ({ Component: (await import('@/pages/training/WorkoutPlansPage')).WorkoutPlansPage }),
  diets: async () => ({ Component: (await import('@/pages/training/DietPlansPage')).DietPlansPage }),
  myMembership: async () => ({ Component: (await import('@/pages/member/MemberPages')).MyMembershipPage }),
  myWorkouts: async () => ({ Component: (await import('@/pages/member/MemberPages')).MyWorkoutsPage }),
  myDiet: async () => ({ Component: (await import('@/pages/member/MemberPages')).MyDietPage }),
  settings: async () => ({ Component: (await import('@/pages/account/SettingsPage')).SettingsPage }),
} satisfies Record<string, Lazy>

/** Each role's area. The API enforces every permission again; these guards decide what the UI shows. */
const AREAS: Record<Role, [string, Lazy][]> = {
  Admin: [
    ['/admin', page.adminDashboard],
    ['/admin/members', page.members],
    ['/admin/members/:id', page.memberDetail],
    ['/admin/trainers', page.trainers],
    ['/admin/plans', page.plans],
    ['/admin/memberships', page.memberships],
    ['/admin/payments', page.payments],
    ['/admin/classes', page.classes],
    ['/admin/attendance', page.attendance],
    ['/admin/audit-logs', page.auditLog],
  ],
  Trainer: [
    ['/trainer', page.trainerDashboard],
    ['/trainer/members', page.members],
    ['/trainer/members/:id', page.memberDetail],
    ['/trainer/workouts', page.workouts],
    ['/trainer/diets', page.diets],
    ['/trainer/classes', page.classes],
    ['/trainer/attendance', page.attendance],
  ],
  Member: [
    ['/member', page.memberDashboard],
    ['/member/membership', page.myMembership],
    ['/member/workouts', page.myWorkouts],
    ['/member/diet', page.myDiet],
    ['/member/classes', page.classes],
    ['/member/attendance', page.attendance],
    ['/member/payments', page.payments],
  ],
}

const roleArea = (role: Role): RouteObject => ({
  element: <RequireRole roles={[role]} />,
  children: AREAS[role].map(([path, lazy]) => ({ path, lazy })),
})

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
            children: [roleArea('Admin'), roleArea('Trainer'), roleArea('Member'), { path: '/settings', lazy: page.settings }, { path: '/403', element: <ForbiddenPage /> }],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
