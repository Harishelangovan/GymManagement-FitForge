import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CalendarDays, Coffee, Dumbbell, Flame, Footprints, Mail, MapPin, Salad, Trophy, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { dashboardApi, type MemberDashboard as MemberData, type MembershipState } from '@/api/dashboard'
import { ChartCard, DataTableView } from '@/components/charts/ChartCard'
import { ColumnChart } from '@/components/charts/Charts'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert, Avatar, Badge, EmptyState, type Tone } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { formatCurrency, formatDate, formatDateTime, formatDay, formatTime, gymDateOf } from '@/lib/format'
import { greeting, todayLabel } from '@/lib/time'
import { DashboardError, DashboardSkeleton, ListCard } from './shared'

const STATE_TONE: Record<MembershipState, Tone> = { Active: 'success', Upcoming: 'info', Expired: 'danger', Cancelled: 'neutral' }

export function MemberDashboard() {
  const query = useQuery({ queryKey: ['dashboard', 'member'], queryFn: dashboardApi.member })

  return query.isPending ? (
    <>
      <PageHeader title={greeting()} description={todayLabel()} />
      <DashboardSkeleton />
    </>
  ) : query.isError ? (
    <>
      <PageHeader title={greeting()} description={todayLabel()} />
      <DashboardError error={query.error} onRetry={() => query.refetch()} />
    </>
  ) : (
    <div className={cn('transition-opacity', query.isFetching && 'opacity-70')}>
      <PageHeader title={`${greeting()}, ${query.data.firstName}`} description={`Here's your week — ${todayLabel()}`} />
      <div className="space-y-6">
        <MemberContent data={query.data} />
      </div>
    </div>
  )
}

function MembershipCard({ membership }: { membership: MemberData['membership'] }) {
  if (!membership) {
    return (
      <Card className="lg:col-span-2">
        <EmptyState icon={BadgeCheck} title="No membership yet" description="Visit the front desk to choose a plan and start training." />
      </Card>
    )
  }

  const elapsed = membership.totalDays - membership.daysRemaining
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / membership.totalDays) * 100)))
  const renewSoon = membership.state === 'Active' && membership.daysRemaining <= 7

  return (
    <Card className="relative overflow-hidden lg:col-span-2">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
      <CardBody className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-subtle uppercase">Your membership</p>
            <h2 className="mt-1 text-2xl font-bold text-fg">{membership.planName}</h2>
          </div>
          <div className="flex gap-2">
            {renewSoon && (
              <Badge tone="warning">
                <TriangleAlert className="size-3" aria-hidden="true" /> Renew soon
              </Badge>
            )}
            <Badge tone={STATE_TONE[membership.state]}>{membership.state}</Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Started</p>
            <p className="font-medium text-fg">{formatDate(membership.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{membership.state === 'Expired' ? 'Ended' : 'Ends'}</p>
            <p className="font-medium text-fg">{formatDate(membership.endDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Days left</p>
            <p className="font-medium text-fg">{membership.state === 'Upcoming' ? `Starts soon` : membership.daysRemaining}</p>
          </div>
        </div>

        {membership.state === 'Active' && (
          <div className="mt-5">
            <div
              className="h-2 overflow-hidden rounded-full bg-accent-soft"
              role="meter"
              aria-label="Membership period used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className={cn('h-full rounded-full', renewSoon ? 'bg-warning' : 'bg-accent')} style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">{progress}% of your plan used</p>
          </div>
        )}

        {membership.balance > 0 && (
          <Alert tone="warning" className="mt-5" title={`${formatCurrency(membership.balance)} due`}>
            Please clear the balance at the front desk.
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}

function MemberContent({ data }: { data: MemberData }) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <MembershipCard membership={data.membership} />

        <Card className="flex flex-col">
          <CardHeader title="Your trainer" />
          {data.trainer ? (
            <CardBody className="flex flex-1 flex-col">
              <div className="flex items-center gap-3">
                <Avatar name={data.trainer.name} className="size-12 text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{data.trainer.name}</p>
                  <p className="truncate text-sm text-muted">{data.trainer.specialization}</p>
                </div>
              </div>
              <a href={`mailto:${data.trainer.email}`} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:underline">
                <Mail className="size-4" aria-hidden="true" />
                {data.trainer.email}
              </a>
            </CardBody>
          ) : (
            <EmptyState icon={Dumbbell} title="No trainer yet" description="The gym will assign a trainer to you." className="py-8" />
          )}
        </Card>
      </div>

      <section aria-label="Your activity" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visits this week" value={data.kpis.visitsThisWeek} icon={Flame} hint="since Monday" />
        <StatCard label="Visits, last 30 days" value={data.kpis.visitsLast30Days} icon={Footprints} />
        <StatCard label="Upcoming classes" value={data.kpis.upcomingClasses} icon={CalendarDays} hint="booked" />
        <StatCard label="Classes attended" value={data.kpis.classesAttended} icon={Trophy} hint="all time" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="Today's workout"
            description={data.todayWorkout ? `${data.todayWorkout.planTitle} · ${data.todayWorkout.day}` : undefined}
            action={
              <Link to="/member/workouts" className="text-sm font-medium text-accent-text hover:underline">
                Full plan
              </Link>
            }
          />
          {!data.todayWorkout ? (
            <EmptyState icon={Dumbbell} title="No workout plan yet" description="Your trainer will create one for you." className="py-10" />
          ) : data.todayWorkout.exercises.length === 0 ? (
            <EmptyState icon={Coffee} title="Rest day" description="Nothing scheduled today. Recovery is part of training." className="py-10" />
          ) : (
            <ol className="divide-y divide-border">
              {data.todayWorkout.exercises.map((e, index) => (
                <li key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-bold text-accent-text">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{e.name}</p>
                    {e.notes && <p className="truncate text-xs text-muted">{e.notes}</p>}
                  </div>
                  <p className="shrink-0 text-right text-sm text-fg tabular-nums">
                    {e.sets} × {e.reps}
                    {e.weightKg ? <span className="text-muted"> · {e.weightKg} kg</span> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <ListCard
          title="Upcoming classes"
          action={
            <Link to="/member/classes" className="text-sm font-medium text-accent-text hover:underline">
              Book a class
            </Link>
          }
          emptyIcon={CalendarDays}
          emptyTitle="No classes booked"
          emptyDescription="Browse the schedule and book your next session."
          isEmpty={data.upcomingClasses.length === 0}
        >
          {data.upcomingClasses.map((c) => (
            <li key={c.classId} className="flex items-center gap-4 px-5 py-3">
              <div className="w-16 shrink-0 text-sm">
                <p className="font-semibold text-fg tabular-nums">{formatTime(c.startUtc)}</p>
                <p className="text-xs text-muted">{formatDay(gymDateOf(c.startUtc))}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{c.title}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted">
                  <MapPin className="size-3" aria-hidden="true" /> {c.location} · {c.trainerName}
                </p>
              </div>
            </li>
          ))}
        </ListCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <ChartCard
          className="lg:col-span-2"
          title="Weekly visits"
          description="Gym check-ins and classes per week, last 8 weeks"
          chart={
            <ColumnChart
              seriesName="Visits"
              formatValue={(v) => `${v} ${v === 1 ? 'visit' : 'visits'}`}
              data={data.visitsByWeek.map((w) => ({ key: w.weekStart, label: formatDate(w.weekStart).slice(0, 6), fullLabel: `Week of ${formatDate(w.weekStart)}`, value: w.visits }))}
            />
          }
          table={<DataTableView headers={['Week of', 'Visits']} rows={[...data.visitsByWeek].reverse().map((w) => [formatDate(w.weekStart), w.visits])} />}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader title="Nutrition" />
            {data.diet ? (
              <CardBody>
                <p className="flex items-center gap-2 font-medium text-fg">
                  <Salad className="size-4 text-accent-text" aria-hidden="true" />
                  {data.diet.title}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted">Calories / day</dt>
                    <dd className="text-lg font-semibold text-fg">{data.diet.dailyCalories.toLocaleString('en-IN')}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted">Protein / day</dt>
                    <dd className="text-lg font-semibold text-fg">{data.diet.proteinGrams} g</dd>
                  </div>
                </dl>
              </CardBody>
            ) : (
              <EmptyState icon={Salad} title="No diet plan yet" className="py-8" />
            )}
          </Card>

          <ListCard title="Recent visits" emptyIcon={Footprints} emptyTitle="No visits yet" isEmpty={data.recentAttendance.length === 0}>
            {data.recentAttendance.map((a) => (
              <li key={a.checkInUtc} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="truncate text-fg">{a.classTitle ?? 'Gym check-in'}</span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(a.checkInUtc)}</span>
              </li>
            ))}
          </ListCard>
        </div>
      </div>
    </>
  )
}
