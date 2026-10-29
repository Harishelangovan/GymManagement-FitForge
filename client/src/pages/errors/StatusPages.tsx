import { SearchX, ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/Feedback'
import { buttonLinkClasses } from './buttonLink'

function StatusScreen({ code, icon, title, description, action }: { code?: string; icon: LucideIcon; title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {code && <p className="font-display text-7xl font-bold text-accent-text/80">{code}</p>}
      <EmptyState icon={icon} title={title} description={description} action={action} className="py-6" />
    </div>
  )
}

const homeLink = (
  <Link to="/" className={buttonLinkClasses}>
    Go to my dashboard
  </Link>
)

export function ForbiddenPage() {
  return (
    <StatusScreen
      code="403"
      icon={ShieldAlert}
      title="You don't have access to this page"
      description="This area belongs to a different role. If you think this is a mistake, contact the gym admin."
      action={homeLink}
    />
  )
}

/** Standalone (outside the app shell), so it works whether or not the visitor is signed in. */
export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <StatusScreen code="404" icon={SearchX} title="Page not found" description="The page you're looking for doesn't exist or has moved." action={homeLink} />
      </div>
    </div>
  )
}

/** Rendered by the router when a page throws while rendering. Never shows technical details. */
export function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-md p-2">
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong"
          description="An unexpected error occurred. Reload the page to try again."
          action={
            <button className={buttonLinkClasses} onClick={() => window.location.reload()}>
              Reload page
            </button>
          }
        />
      </Card>
    </div>
  )
}
