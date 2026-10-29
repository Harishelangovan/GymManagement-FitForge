import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarCheck, CalendarDays, ClipboardList, Dumbbell, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router'
import { dashboardApi, type Session, type TrainerDashboard as TrainerData } from '@/api/dashboard'
import { useCurrentUser } from '@/auth/authContext'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Avatar, Badge, EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { formatDateTime, formatDay, formatTime, gymDateOf } from '@/lib/format'
import { greeting, todayLabel } from '@/lib/time'
import { AttendanceChartCard, DashboardError, DashboardSkeleton, ListCard } from './shared'

export function TrainerDashboard() {
  const user = useCurrentUser()
  const query = useQuery({ queryKey: ['dashboard', 'trainer'], queryFn: dashboardApi.trainer })

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.firstName}`} description={`Your training day — ${todayLabel()}`} />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <DashboardError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className={cn('space-y-6 transition-opacity', query.isFetching && 'opacity-70')}>
          <TrainerContent data={query.data} />
        </div>
      )}
    </>
  )
}

function SessionRow({ session, showDay = false }: { session: Session; showDay?: boolean }) {
  const fillPercent = Math.min(100, Math.round((session.bookedCount / session.capacity) * 100))
  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <div className="w-16 shrink-0 text-sm">
        <p className="font-semibold text-fg tabular-nums">{formatTime(session.startUtc)}</p>
        {showDay && <p className="text-xs text-muted">{formatDay(gymDateOf(session.startUtc))}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{session.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3" aria-hidden="true" />
          {session.location}
        </p>
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="text-xs text-muted">
          <span className="font-semibold text-fg">{session.bookedCount}</span>/{session.capacity} booked
        </p>
        {/* Meter: lime fill on a lighter track of the same hue. */}
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${fillPercent}%` }} />
        </div>
      </div>
    </li>
  )
}

function TrainerContent({ data }: { data: TrainerData }) {
  const { kpis } = data
  const upcoming = data.nextSevenDays.filter((s) => !data.todaySessions.some((t) => t.id === s.id))

  return (
    <>
      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned members" value={kpis.assignedMembers} icon={Users} hint={`${kpis.activeWorkoutPlans} with an active plan`} />
        <StatCard label="Sessions today" value={kpis.sessionsToday} icon={CalendarCheck} hint={`${data.nextSevenDays.length} in the next 7 days`} />
        <StatCard label="Bookings, next 7 days" value={kpis.bookingsThisWeek} icon={CalendarDays} hint="across your classes" />
        <StatCard
          label="Members without a plan"
          value={kpis.membersWithoutWorkoutPlan}
          icon={ClipboardList}
          tone={kpis.membersWithoutWorkoutPlan > 0 ? 'warning' : 'default'}
          hint={kpis.membersWithoutWorkoutPlan > 0 ? 'need a workout plan' : 'everyone is covered'}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <ListCard
          className="lg:col-span-2"
          title="Today's sessions"
          emptyIcon={CalendarCheck}
          emptyTitle="No sessions today"
          emptyDescription={upcoming[0] ? `Next: ${upcoming[0].title}, ${formatDay(gymDateOf(upcoming[0].startUtc), 'long')} at ${formatTime(upcoming[0].startUtc)}.` : undefined}
          isEmpty={data.todaySessions.length === 0}
        >
          {data.todaySessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ListCard>

        <ListCard
          className="lg:col-span-3"
          title="Coming up"
          description="Your classes over the next 7 days"
          action={
            <Link to="/trainer/classes" className="text-sm font-medium text-accent-text hover:underline">
              Manage classes
            </Link>
          }
          emptyIcon={CalendarDays}
          emptyTitle="Nothing scheduled"
          emptyDescription="Schedule a class to see it here."
          isEmpty={upcoming.length === 0}
        >
          {upcoming.map((s) => (
            <SessionRow key={s.id} session={s} showDay />
          ))}
        </ListCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceChartCard
          days={data.attendanceByDay}
          title="Attendance"
          description="Visits to your classes and your members' gym check-ins, last 14 days"
        />
        <ListCard title="Recent member activity" emptyIcon={Activity} emptyTitle="No activity yet" isEmpty={data.recentActivity.length === 0}>
          {data.recentActivity.map((a, i) => (
            <li key={`${a.atUtc}-${i}`} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={a.memberName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{a.memberName}</p>
                <p className="truncate text-xs text-muted">{a.description}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">{formatDateTime(a.atUtc)}</span>
            </li>
          ))}
        </ListCard>
      </div>

      <Card>
        <CardHeader
          title="Members without a workout plan"
          description="Assigned to you, with no active plan"
          action={
            <Link to="/trainer/workouts" className="text-sm font-medium text-accent-text hover:underline">
              Workout plans
            </Link>
          }
        />
        {data.membersWithoutWorkoutPlan.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Everyone has a plan" description="All your members have an active workout plan." className="py-10" />
        ) : (
          <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {data.membersWithoutWorkoutPlan.map((m) => (
              <li key={m.memberProfileId} className="flex items-center gap-3 bg-surface px-5 py-4">
                <Avatar name={m.memberName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{m.memberName}</p>
                  <p className="truncate text-xs text-muted">Goal: {m.fitnessGoal ?? 'not set'}</p>
                </div>
                <Badge tone="warning">No plan</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
