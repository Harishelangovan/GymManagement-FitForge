import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { useCurrentUser } from '@/auth/authContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { NAVIGATION } from '@/routes/navigation'

const GREETING_BY_ROLE = {
  Admin: 'Here is everything you can manage across the gym.',
  Trainer: 'Your members, plans and sessions in one place.',
  Member: 'Your membership, plans and classes in one place.',
} as const

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * Landing page for each role. In Phase 7 this becomes the full dashboard (stats and charts from the API);
 * for now it greets the user and links to every area of their workspace.
 */
export function RoleHomePage() {
  const user = useCurrentUser()
  const sections = NAVIGATION[user.role].slice(1)

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.firstName}`} description={GREETING_BY_ROLE[user.role]} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((item) => (
          <Link key={item.path} to={item.path} className="group">
            <Card className="h-full p-5 transition-colors group-hover:border-border-strong">
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-text">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-semibold text-fg">{item.label}</h2>
              {item.phase > 6 && (
                <Badge tone="neutral" className="mt-2">
                  Arrives in Phase {item.phase}
                </Badge>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
