import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Coffee, Dumbbell, Salad } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { dietsApi, membershipsApi, plansApi, workoutsApi, type DayOfWeek, type WorkoutPlan } from '@/api/resources'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Controls'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDate, formatDay, gymToday } from '@/lib/format'
import { DAYS_OF_WEEK, MEMBERSHIP_STATE_TONE } from '@/lib/status'

// ---------- Membership ----------

export function MyMembershipPage() {
  const memberships = useQuery({ queryKey: ['memberships', 'mine'], queryFn: membershipsApi.mine })
  const plans = useQuery({ queryKey: ['plans', 'active'], queryFn: () => plansApi.list(false) })

  return (
    <>
      <PageHeader title="Membership" description="Your plans past and present. To renew or upgrade, visit the front desk." />
      {memberships.isError ? (
        <Alert tone="danger">{errorMessage(memberships.error)}</Alert>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title="History" />
          {memberships.isPending ? (
            <CardBody>
              <Skeleton className="h-24" />
            </CardBody>
          ) : memberships.data.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="No memberships yet" description="Choose a plan below and buy it at the front desk." />
          ) : (
            <ul className="divide-y divide-border">
              {memberships.data.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-fg">{m.planName}</p>
                    <p className="text-sm text-muted">
                      {formatDate(m.startDate)} – {formatDate(m.endDate)}
                      {m.state === 'Active' && ` · ${m.daysRemaining} days left`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-fg tabular-nums">{formatCurrency(m.priceAtPurchase)}</p>
                    {m.balance > 0 && m.state !== 'Cancelled' ? <p className="text-xs font-medium text-warning">{formatCurrency(m.balance)} due</p> : <p className="text-xs text-muted">Paid</p>}
                  </div>
                  <Badge tone={MEMBERSHIP_STATE_TONE[m.state]}>{m.state}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <h2 className="mt-8 mb-4 text-lg font-semibold text-fg">Available plans</h2>
      {plans.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.data?.map((p) => (
            <Card key={p.id} className="p-5">
              <p className="font-semibold text-fg">{p.name}</p>
              <p className="mt-2 text-2xl font-semibold text-fg">{formatCurrency(p.price)}</p>
              <p className="text-sm text-muted">{p.durationDays} days</p>
              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

// ---------- Workouts ----------

const todayName = () => DAYS_OF_WEEK[(new Date(`${gymToday()}T12:00:00Z`).getUTCDay() + 6) % 7] as DayOfWeek

export function MyWorkoutsPage() {
  const query = useQuery({ queryKey: ['workouts', 'mine'], queryFn: workoutsApi.mine })
  const [day, setDay] = useState<DayOfWeek>(todayName)

  if (query.isPending) return <Skeleton className="h-80" />
  if (query.isError) return <Alert tone="danger">{errorMessage(query.error)}</Alert>

  const active = query.data.find((p) => p.isActive)
  const past = query.data.filter((p) => !p.isActive)

  return (
    <>
      <PageHeader title="Workouts" description={active ? `${active.title} — by ${active.trainerName}` : 'Your trainer writes your plan.'} />
      {!active ? (
        <Card>
          <EmptyState icon={Dumbbell} title="No active workout plan" description="Your trainer will create one for you." />
        </Card>
      ) : (
        <ActivePlan plan={active} day={day} onDayChange={setDay} />
      )}

      {past.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Previous plans" />
          <ul className="divide-y divide-border">
            {past.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-fg">{p.title}</span>
                <span className="text-muted">
                  {formatDate(p.startDate)}
                  {p.endDate && ` – ${formatDate(p.endDate)}`} · {p.exercises.length} exercises
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function ActivePlan({ plan, day, onDayChange }: { plan: WorkoutPlan; day: DayOfWeek; onDayChange: (d: DayOfWeek) => void }) {
  const exercises = plan.exercises.filter((e) => e.dayOfWeek === day).sort((a, b) => a.sortOrder - b.sortOrder)
  const today = todayName()

  return (
    <Card>
      <div className="overflow-x-auto border-b border-border px-5 py-3">
        <Segmented
          label="Day of the week"
          value={day}
          onChange={onDayChange}
          options={DAYS_OF_WEEK.map((d) => {
            const count = plan.exercises.filter((e) => e.dayOfWeek === d).length
            return { value: d, label: `${d.slice(0, 3)}${d === today ? ' · today' : ''}${count ? ` (${count})` : ''}` }
          })}
        />
      </div>
      {exercises.length === 0 ? (
        <EmptyState icon={Coffee} title={`Rest on ${day}`} description="No exercises planned for this day." />
      ) : (
        <ol className="divide-y divide-border">
          {exercises.map((e, i) => (
            <li key={e.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm font-bold text-accent-text">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{e.name}</p>
                {e.notes && <p className="text-sm text-muted">{e.notes}</p>}
              </div>
              <dl className="flex gap-5 text-sm">
                <div>
                  <dt className="text-xs text-muted">Sets × reps</dt>
                  <dd className="font-semibold text-fg tabular-nums">
                    {e.sets} × {e.reps}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Weight</dt>
                  <dd className="font-semibold text-fg tabular-nums">{e.weightKg ? `${e.weightKg} kg` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Rest</dt>
                  <dd className="font-semibold text-fg tabular-nums">{e.restSeconds}s</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
      <p className="border-t border-border px-5 py-3 text-xs text-muted">
        Plan started {formatDate(plan.startDate)}. Today is {formatDay(gymToday(), 'long')}.
      </p>
    </Card>
  )
}

// ---------- Diet ----------

export function MyDietPage() {
  const query = useQuery({ queryKey: ['diets', 'mine'], queryFn: dietsApi.mine })

  if (query.isPending) return <Skeleton className="h-80" />
  if (query.isError) return <Alert tone="danger">{errorMessage(query.error)}</Alert>
  const active = query.data.find((p) => p.isActive)

  return (
    <>
      <PageHeader title="Diet" description={active ? `${active.title} — by ${active.trainerName}` : 'Your trainer writes your nutrition plan.'} />
      {!active ? (
        <Card>
          <EmptyState icon={Salad} title="No diet plan yet" />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-muted">Calories per day</p>
              <p className="mt-1 text-3xl font-semibold text-fg">{active.dailyCalories.toLocaleString('en-IN')} kcal</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Protein per day</p>
              <p className="mt-1 text-3xl font-semibold text-fg">{active.proteinGrams} g</p>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ['Breakfast', active.breakfast],
                ['Lunch', active.lunch],
                ['Dinner', active.dinner],
                ['Snacks', active.snacks],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([meal, text]) => (
                <Card key={meal} className="p-5">
                  <h2 className="font-semibold text-accent-text">{meal}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-fg">{text}</p>
                </Card>
              ))}
          </div>
          {active.notes && <Alert tone="info" title="Notes from your trainer">{active.notes}</Alert>}
        </div>
      )}
    </>
  )
}
