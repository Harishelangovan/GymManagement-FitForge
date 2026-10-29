import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { attendanceApi, classesApi, type Booking, type FitnessClass } from '@/api/resources'
import { useCurrentUser } from '@/auth/authContext'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchTrainers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Segmented } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { applyServerErrors } from '@/lib/forms'
import { addDays, formatDateTime, formatDay, formatTime, gymDateOf, gymLocalToUtc, gymToday, startOfWeek, utcToGymLocal } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { orNull } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'
import { useNow } from '@/lib/useNow'

const CANCELLATION_CUTOFF_MS = 2 * 60 * 60 * 1000

export function ClassesPage() {
  const user = useCurrentUser()
  const isMember = user.role === 'Member'
  const { page, values, set, setPage } = useListParams({ week: '', view: 'schedule' })
  const weekStart = values.week || startOfWeek(gymToday())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const now = useNow()

  const query = useQuery({
    queryKey: ['classes', weekStart],
    queryFn: () =>
      classesApi.list({
        fromUtc: gymLocalToUtc(weekStart, '00:00'),
        toUtc: gymLocalToUtc(addDays(weekStart, 7), '00:00'),
        includeCancelled: !isMember,
        pageSize: 100,
      }),
    placeholderData: keepPreviousData,
  })
  const selected = query.data?.items.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <PageHeader
        title="Classes"
        description={isMember ? 'Book a spot in any class while your membership is active.' : 'The weekly class schedule.'}
        actions={
          !isMember && (
            <Button leftIcon={<CalendarPlus className="size-4" />} onClick={() => setScheduling(true)}>
              Schedule class
            </Button>
          )
        }
      />

      {isMember && (
        <div className="mb-4">
          <Segmented
            label="View"
            value={values.view}
            options={[
              { value: 'schedule', label: 'Schedule' },
              { value: 'bookings', label: 'My bookings' },
            ]}
            onChange={(v) => set('view', v === 'schedule' ? '' : v)}
          />
        </div>
      )}

      {isMember && values.view === 'bookings' ? (
        <MyBookings page={page} setPage={setPage} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="icon" aria-label="Previous week" onClick={() => set('week', addDays(weekStart, -7))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Next week" onClick={() => set('week', addDays(weekStart, 7))}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => set('week', '')}>
              This week
            </Button>
            <p className="ml-1 text-sm font-medium text-fg">
              {formatDay(weekStart, 'long')} – {formatDay(addDays(weekStart, 6), 'long')}
            </p>
          </div>

          {query.isError ? (
            <Alert tone="danger">{errorMessage(query.error)}</Alert>
          ) : query.isPending ? (
            <Skeleton className="h-96" />
          ) : (
            <div className={cn('grid gap-3 transition-opacity xl:grid-cols-7', query.isFetching && 'opacity-70')}>
              {days.map((day) => {
                const classes = query.data.items.filter((c) => gymDateOf(c.startUtc) === day)
                const isToday = day === gymToday()
                return (
                  <section key={day} aria-label={formatDay(day, 'long')} className="min-w-0">
                    <h2 className={cn('mb-2 px-1 text-sm font-semibold', isToday ? 'text-accent-text' : 'text-muted')}>
                      {formatDay(day)}
                      {isToday && ' · Today'}
                    </h2>
                    <div className="space-y-2">
                      {classes.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">No classes</p>
                      ) : (
                        classes.map((c) => (
                          <ClassCard key={c.id} fitnessClass={c} onOpen={() => setSelectedId(c.id)} isMine={c.trainerProfileId === user.trainerProfileId} ended={new Date(c.endUtc).getTime() < now} />
                        ))
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {selected && <ClassDetailModal fitnessClass={selected} onClose={() => setSelectedId(null)} />}
      {scheduling && <ClassFormModal onClose={() => setScheduling(false)} />}
    </>
  )
}

function ClassCard({ fitnessClass: c, onOpen, isMine, ended }: { fitnessClass: FitnessClass; onOpen: () => void; isMine: boolean; ended: boolean }) {
  const percent = Math.min(100, Math.round((c.bookedCount / c.capacity) * 100))
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full cursor-pointer rounded-xl border bg-surface p-3 text-left transition-colors hover:border-border-strong',
        c.isBookedByMe ? 'border-accent/60' : isMine ? 'border-info/40' : 'border-border',
        (c.isCancelled || ended) && 'opacity-60',
      )}
    >
      <p className="text-xs font-semibold text-muted tabular-nums">
        {formatTime(c.startUtc)} – {formatTime(c.endUtc)}
      </p>
      <p className={cn('mt-0.5 line-clamp-2 text-sm leading-snug font-semibold text-fg', c.isCancelled && 'line-through')}>{c.title}</p>
      <p className="truncate text-xs text-muted">{c.trainerName}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {c.isCancelled ? (
          <Badge tone="danger">Cancelled</Badge>
        ) : ended ? (
          <Badge>Ended</Badge>
        ) : c.isBookedByMe ? (
          <Badge tone="accent">Booked</Badge>
        ) : c.spotsLeft === 0 ? (
          <Badge tone="warning">Full</Badge>
        ) : (
          <Badge>{c.spotsLeft} left</Badge>
        )}
      </div>
      {!c.isCancelled && !ended && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      )}
    </button>
  )
}

// ---------- Detail: book / manage / roster ----------

function ClassDetailModal({ fitnessClass: c, onClose }: { fitnessClass: FitnessClass; onClose: () => void }) {
  const user = useCurrentUser()
  const isMember = user.role === 'Member'
  const canManage = user.role === 'Admin' || (user.role === 'Trainer' && user.trainerProfileId === c.trainerProfileId)
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const now = useNow()
  const started = new Date(c.startUtc).getTime() <= now
  const withinCutoff = new Date(c.startUtc).getTime() - now < CANCELLATION_CUTOFF_MS

  const book = useApiMutation(() => classesApi.book(c.id), { invalidate: [['classes'], ['bookings']], success: `You're booked into ${c.title}.` })
  const unbook = useApiMutation(() => classesApi.cancelMyBooking(c.id), { invalidate: [['classes'], ['bookings']], success: 'Booking cancelled.' })
  const cancelClass = useApiMutation(() => classesApi.cancel(c.id), {
    invalidate: [['classes'], ['bookings']],
    success: `${c.title} was cancelled and its bookings released.`,
    onSuccess: () => setConfirmCancel(false),
  })

  if (editing) return <ClassFormModal existing={c} onClose={() => setEditing(false)} />

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={c.title}
        description={`${formatDay(gymDateOf(c.startUtc), 'long')} · ${formatTime(c.startUtc)} – ${formatTime(c.endUtc)}`}
        footer={
          <>
            {canManage && !c.isCancelled && !started && (
              <>
                <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                  Cancel class
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </>
            )}
            {isMember &&
              !c.isCancelled &&
              !started &&
              (c.isBookedByMe ? (
                <Button variant="outline" onClick={() => unbook.mutate(undefined)} loading={unbook.isPending} disabled={withinCutoff}>
                  Cancel my booking
                </Button>
              ) : (
                <Button onClick={() => book.mutate(undefined)} loading={book.isPending} disabled={c.spotsLeft === 0}>
                  {c.spotsLeft === 0 ? 'Class is full' : 'Book a spot'}
                </Button>
              ))}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {c.isCancelled && <Alert tone="danger">This class has been cancelled.</Alert>}
          {isMember && c.isBookedByMe && withinCutoff && !started && <Alert tone="info">Bookings can only be cancelled up to 2 hours before the class starts.</Alert>}
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-subtle" aria-hidden="true" />
              <dt className="sr-only">Trainer</dt>
              <dd className="text-fg">{c.trainerName}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-subtle" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd className="text-fg">{c.location}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-subtle" aria-hidden="true" />
              <dt className="sr-only">Spots</dt>
              <dd className="text-fg">
                {c.bookedCount} / {c.capacity} booked
              </dd>
            </div>
          </dl>
          {c.description && <p className="text-sm text-muted">{c.description}</p>}
          {canManage && <Roster fitnessClass={c} />}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelClass.mutate(undefined)}
        loading={cancelClass.isPending}
        title={`Cancel ${c.title}?`}
        confirmLabel="Cancel class"
        description={`All ${c.bookedCount} bookings will be cancelled. This can't be undone.`}
      />
    </>
  )
}

function Roster({ fitnessClass: c }: { fitnessClass: FitnessClass }) {
  const roster = useQuery({ queryKey: ['roster', c.id], queryFn: () => classesApi.roster(c.id) })
  const opensAt = new Date(c.startUtc).getTime() - 30 * 60 * 1000
  const now = useNow()
  const canMark = !c.isCancelled && now >= opensAt
  const mark = useApiMutation((memberProfileId: number) => attendanceApi.mark(memberProfileId, c.id), {
    invalidate: [['roster', c.id], ['attendance']],
    success: (a) => `${a.memberName} marked present.`,
  })

  return (
    <section className="rounded-xl border border-border">
      <h3 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-fg">Roster</h3>
      {roster.isPending ? (
        <Skeleton className="m-4 h-12" />
      ) : roster.data?.length ? (
        <ul className="divide-y divide-border">
          {roster.data.map((r) => (
            <li key={r.bookingId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{r.memberName}</p>
                <p className="truncate text-xs text-muted">{r.memberEmail}</p>
              </div>
              {r.attended ? (
                <Badge tone="success">Present</Badge>
              ) : (
                <Button size="sm" variant="secondary" disabled={!canMark || mark.isPending} onClick={() => mark.mutate(r.memberProfileId)} title={canMark ? undefined : 'Opens 30 minutes before the class'}>
                  Mark present
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted">No bookings yet.</p>
      )}
      {!canMark && !c.isCancelled && <p className="border-t border-border px-4 py-2 text-xs text-muted">Attendance opens 30 minutes before the class starts.</p>}
    </section>
  )
}

// ---------- Create / edit ----------

const classSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(150),
    description: z.string().max(1000),
    date: z.string().min(1, 'Date is required.'),
    startTime: z.string().min(1, 'Start time is required.'),
    durationMinutes: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 15 && Number(v) <= 240, 'Enter 15–240 minutes.'),
    capacity: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 500, 'Enter 1–500.'),
    location: z.string().trim().min(1, 'Location is required.').max(100),
  })
  .refine((v) => new Date(gymLocalToUtc(v.date, v.startTime)).getTime() > Date.now(), { path: ['startTime'], message: 'The class must start in the future.' })
type ClassValues = z.infer<typeof classSchema>

function ClassFormModal({ existing, onClose }: { existing?: FitnessClass; onClose: () => void }) {
  const user = useCurrentUser()
  const isAdmin = user.role === 'Admin'
  const [trainer, setTrainer] = useState<PickerOption | null>(existing ? { id: existing.trainerProfileId, label: existing.trainerName } : null)
  const [formError, setFormError] = useState<string | null>(null)
  const start = existing ? utcToGymLocal(existing.startUtc) : { date: addDays(gymToday(), 1), time: '07:00' }

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClassValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      title: existing?.title ?? '',
      description: existing?.description ?? '',
      date: start.date,
      startTime: start.time,
      durationMinutes: String(existing ? Math.round((new Date(existing.endUtc).getTime() - new Date(existing.startUtc).getTime()) / 60000) : 60),
      capacity: String(existing?.capacity ?? 15),
      location: existing?.location ?? '',
    },
  })

  const save = useApiMutation(
    (v: ClassValues) => {
      const startUtc = gymLocalToUtc(v.date, v.startTime)
      const input = {
        title: v.title.trim(),
        description: orNull(v.description),
        startUtc,
        endUtc: new Date(new Date(startUtc).getTime() + Number(v.durationMinutes) * 60000).toISOString(),
        capacity: Number(v.capacity),
        location: v.location.trim(),
      }
      return existing ? classesApi.update(existing.id, input) : classesApi.create({ ...input, trainerProfileId: isAdmin ? (trainer?.id ?? null) : null })
    },
    { invalidate: [['classes']], toastErrors: false, success: (c) => `${c.title} scheduled for ${formatDateTime(c.startUtc)}.`, onSuccess: onClose },
  )

  const onSubmit = handleSubmit(async (values) => {
    if (isAdmin && !existing && !trainer) {
      setFormError('Choose the trainer who will lead this class.')
      return
    }
    setFormError(null)
    try {
      await save.mutateAsync(values)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  const f = (name: keyof ClassValues) => ({ ...fieldProps(`cl-${name}`, errors[name]?.message), ...register(name) })

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit ${existing.title}` : 'Schedule a class'}
      description="Times are in gym time (IST). A trainer can't lead two classes at once."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" loading={isSubmitting}>
            {existing ? 'Save changes' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field id="cl-title" label="Title" error={errors.title?.message}>
          <Input placeholder="e.g. HIIT Express" {...f('title')} />
        </Field>
        {isAdmin && !existing && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cl-trainer" className="text-sm font-medium text-fg">
              Trainer
            </label>
            <EntityPicker name="trainer-picker" inputId="cl-trainer" search={searchTrainers} value={trainer} onChange={setTrainer} placeholder="Search trainers…" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cl-date" label="Date" error={errors.date?.message}>
            <Input type="date" min={gymToday()} {...f('date')} />
          </Field>
          <Field id="cl-startTime" label="Start time" error={errors.startTime?.message}>
            <Input type="time" step={300} {...f('startTime')} />
          </Field>
          <Field id="cl-durationMinutes" label="Minutes" error={errors.durationMinutes?.message}>
            <Input type="number" min="15" max="240" step="5" {...f('durationMinutes')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cl-capacity" label="Capacity" error={errors.capacity?.message} hint={existing ? `${existing.bookedCount} already booked` : undefined}>
            <Input type="number" min="1" {...f('capacity')} />
          </Field>
          <Field id="cl-location" label="Location" error={errors.location?.message}>
            <Input placeholder="e.g. Studio A" {...f('location')} />
          </Field>
        </div>
        <Field id="cl-description" label="Description (optional)" error={errors.description?.message}>
          <Textarea rows={2} {...f('description')} />
        </Field>
      </form>
    </Modal>
  )
}

// ---------- Member: my bookings ----------

function MyBookings({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming')
  const now = useNow()
  const query = useQuery({
    queryKey: ['bookings', when, page],
    queryFn: () => classesApi.myBookings({ upcoming: when === 'upcoming', page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  })
  const unbook = useApiMutation((b: Booking) => classesApi.cancelMyBooking(b.fitnessClassId), { invalidate: [['classes'], ['bookings']], success: 'Booking cancelled.' })

  return (
    <>
      <div className="mb-4">
        <Segmented
          label="Bookings"
          value={when}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          onChange={(v) => {
            setWhen(v)
            setPage(1)
          }}
        />
      </div>
      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : query.isPending ? (
        <Skeleton className="h-48" />
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title={when === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'} />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {query.data.items.map((b) => {
              const cancellable = b.status === 'Booked' && !b.isClassCancelled && new Date(b.classStartUtc).getTime() - now >= CANCELLATION_CUTOFF_MS
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                  <div className="w-24 shrink-0 text-sm">
                    <p className="font-semibold text-fg tabular-nums">{formatTime(b.classStartUtc)}</p>
                    <p className="text-xs text-muted">{formatDay(gymDateOf(b.classStartUtc))}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{b.classTitle}</p>
                    <p className="truncate text-xs text-muted">
                      {b.location} · {b.trainerName}
                    </p>
                  </div>
                  {b.isClassCancelled ? <Badge tone="danger">Class cancelled</Badge> : b.status === 'Cancelled' ? <Badge>You cancelled</Badge> : <Badge tone="accent">Booked</Badge>}
                  {cancellable && (
                    <Button size="sm" variant="ghost" onClick={() => unbook.mutate(b)} disabled={unbook.isPending}>
                      Cancel
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <Pagination {...query.data} onPageChange={setPage} />
        </Card>
      )}
    </>
  )
}
