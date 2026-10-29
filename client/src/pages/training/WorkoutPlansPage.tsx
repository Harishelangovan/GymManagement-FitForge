import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { membersApi, workoutsApi, type DayOfWeek, type WorkoutPlan } from '@/api/resources'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchMembers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFilters, FilterBar, Segmented, Switch } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { applyServerErrors } from '@/lib/forms'
import { formatDate, gymToday } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { DAYS_OF_WEEK, numberOrNull, orNull } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'

/** Trainer: workout plans for assigned members (the API limits the list and every write to them). */
export function WorkoutPlansPage() {
  const { page, values, set, setPage } = useListParams({ member: '', status: 'active' })
  const memberId = Number(values.member) || undefined
  const [editing, setEditing] = useState<WorkoutPlan | 'new' | null>(null)

  const member = useQuery({ queryKey: ['member', memberId], queryFn: () => membersApi.get(memberId!), enabled: Boolean(memberId) })
  const memberOption: PickerOption | null = member.data ? { id: member.data.id, label: `${member.data.firstName} ${member.data.lastName}`, detail: member.data.email } : null

  const query = useQuery({
    queryKey: ['workouts', page, values],
    queryFn: () => workoutsApi.list({ page, pageSize: 10, memberId, isActive: values.status === 'all' ? undefined : values.status === 'active' }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        title="Workout plans"
        description="One active plan per member. Activating a plan retires the member's previous one."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New plan
          </Button>
        }
      />
      <FilterBar>
        <div className="w-full sm:w-72">
          <EntityPicker name="member-picker" search={searchMembers} value={memberOption} onChange={(o) => set('member', o ? String(o.id) : '')} placeholder="Filter by member…" />
        </div>
        <Segmented
          label="Plan status"
          value={values.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Retired' },
            { value: 'all', label: 'All' },
          ]}
          onChange={(v) => set('status', v === 'active' ? '' : v)}
        />
        <ClearFilters visible={Boolean(values.member) || values.status !== 'active'} onClear={() => { set('member', ''); set('status', '') }} />
      </FilterBar>

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={Dumbbell} title="No workout plans here" description="Create a plan for one of your members." action={<Button onClick={() => setEditing('new')}>New plan</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data.items.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
            ))}
          </div>
          <Card className="mt-4">
            <Pagination {...query.data} onPageChange={setPage} />
          </Card>
        </>
      )}

      {editing && <WorkoutPlanEditor plan={editing === 'new' ? null : editing} presetMember={memberOption} onClose={() => setEditing(null)} />}
    </>
  )
}

function PlanCard({ plan, onEdit }: { plan: WorkoutPlan; onEdit: () => void }) {
  const byDay = DAYS_OF_WEEK.map((day) => ({ day, exercises: plan.exercises.filter((e) => e.dayOfWeek === day) })).filter((d) => d.exercises.length > 0)

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{plan.memberName}</p>
          <h2 className="truncate text-lg font-semibold text-fg">{plan.title}</h2>
          {plan.goal && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{plan.goal}</p>}
        </div>
        {plan.isActive ? <Badge tone="success">Active</Badge> : <Badge>Retired</Badge>}
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {byDay.map(({ day, exercises }) => (
          <li key={day} className="flex gap-3 text-sm">
            <span className="w-10 shrink-0 font-semibold text-accent-text">{day.slice(0, 3)}</span>
            <span className="min-w-0 text-muted">{exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join(' · ')}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
        <span>
          From {formatDate(plan.startDate)}
          {plan.endDate && ` to ${formatDate(plan.endDate)}`}
        </span>
        <Button size="sm" variant="secondary" leftIcon={<Pencil className="size-3.5" />} onClick={onEdit}>
          Edit
        </Button>
      </div>
    </Card>
  )
}

// ---------- Editor ----------

const intIn = (min: number, max: number, label: string) =>
  z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max, `${label} ${min}–${max}`)

const exerciseSchema = z.object({
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  name: z.string().trim().min(1, 'Name required').max(150),
  sets: intIn(1, 20, 'Sets'),
  reps: intIn(1, 200, 'Reps'),
  weightKg: z.string().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 1000), 'Weight 0–1000'),
  restSeconds: intIn(0, 900, 'Rest'),
  notes: z.string().max(500),
})

const planSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(150),
    goal: z.string().max(500),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string(),
    exercises: z.array(exerciseSchema).min(1, 'Add at least one exercise.').max(60, 'At most 60 exercises.'),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'End date must be on or after the start date.' })
type PlanValues = z.infer<typeof planSchema>

const blankExercise = (day: DayOfWeek = 'Monday'): PlanValues['exercises'][number] => ({ dayOfWeek: day, name: '', sets: '3', reps: '10', weightKg: '', restSeconds: '60', notes: '' })

function WorkoutPlanEditor({ plan, presetMember, onClose }: { plan: WorkoutPlan | null; presetMember: PickerOption | null; onClose: () => void }) {
  const [member, setMember] = useState<PickerOption | null>(plan ? { id: plan.memberProfileId, label: plan.memberName } : presetMember)
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: plan?.title ?? '',
      goal: plan?.goal ?? '',
      startDate: plan?.startDate ?? gymToday(),
      endDate: plan?.endDate ?? '',
      exercises: plan
        ? plan.exercises.map((e) => ({ dayOfWeek: e.dayOfWeek, name: e.name, sets: String(e.sets), reps: String(e.reps), weightKg: e.weightKg?.toString() ?? '', restSeconds: String(e.restSeconds), notes: e.notes ?? '' }))
        : [blankExercise()],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' })

  const save = useApiMutation(
    (v: PlanValues) => {
      const exercises = v.exercises.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        name: e.name.trim(),
        sets: Number(e.sets),
        reps: Number(e.reps),
        weightKg: numberOrNull(e.weightKg),
        restSeconds: Number(e.restSeconds),
        notes: orNull(e.notes),
      }))
      const common = { title: v.title.trim(), goal: orNull(v.goal), startDate: v.startDate, endDate: orNull(v.endDate), exercises }
      return plan ? workoutsApi.update(plan.id, { ...common, isActive }) : workoutsApi.create({ ...common, memberProfileId: member!.id })
    },
    { invalidate: [['workouts']], toastErrors: false, success: (p) => `${p.title} saved for ${p.memberName}.`, onSuccess: onClose },
  )

  const onSubmit = handleSubmit(async (values) => {
    if (!plan && !member) {
      setFormError('Choose the member this plan is for.')
      return
    }
    setFormError(null)
    try {
      await save.mutateAsync(values)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={plan ? `Edit ${plan.title}` : 'New workout plan'}
      description={plan ? `For ${plan.memberName}` : 'Exercises appear to the member grouped by day, in the order listed here.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="workout-form" loading={isSubmitting}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="workout-form" onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        {!plan && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wp-member" className="text-sm font-medium text-fg">
              Member
            </label>
            <EntityPicker name="member-picker" inputId="wp-member" search={searchMembers} value={member} onChange={setMember} placeholder="Search your members…" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="wp-title" label="Title" error={errors.title?.message}>
            <Input placeholder="e.g. Hypertrophy block" {...fieldProps('wp-title', errors.title?.message)} {...register('title')} />
          </Field>
          <Field id="wp-goal" label="Goal (optional)" error={errors.goal?.message}>
            <Input {...fieldProps('wp-goal', errors.goal?.message)} {...register('goal')} />
          </Field>
          <Field id="wp-startDate" label="Start date" error={errors.startDate?.message}>
            <Input type="date" {...fieldProps('wp-startDate', errors.startDate?.message)} {...register('startDate')} />
          </Field>
          <Field id="wp-endDate" label="End date (optional)" error={errors.endDate?.message}>
            <Input type="date" {...fieldProps('wp-endDate', errors.endDate?.message)} {...register('endDate')} />
          </Field>
        </div>
        {plan && <Switch id="wp-active" checked={isActive} onChange={setIsActive} label="Active plan" description="Activating this plan retires the member's other active plan." />}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Exercises</legend>
          {errors.exercises?.root?.message && <p className="mb-2 text-xs font-medium text-danger">{errors.exercises.root.message}</p>}
          {errors.exercises?.message && <p className="mb-2 text-xs font-medium text-danger">{errors.exercises.message}</p>}
          <div className="space-y-3">
            {fields.map((field, index) => {
              const e = errors.exercises?.[index]
              const firstError = e?.name?.message ?? e?.sets?.message ?? e?.reps?.message ?? e?.weightKg?.message ?? e?.restSeconds?.message ?? e?.notes?.message
              return (
                <div key={field.id} className={cn('rounded-xl border border-border bg-surface-2 p-3', e && 'border-danger/50')}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[8rem_1fr_4.5rem_4.5rem_5.5rem_5rem_auto]">
                    <Select aria-label={`Exercise ${index + 1} day`} {...register(`exercises.${index}.dayOfWeek`)}>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                    <Input aria-label={`Exercise ${index + 1} name`} placeholder="Exercise" aria-invalid={e?.name ? true : undefined} {...register(`exercises.${index}.name`)} />
                    <Input aria-label="Sets" placeholder="Sets" type="number" min="1" aria-invalid={e?.sets ? true : undefined} {...register(`exercises.${index}.sets`)} />
                    <Input aria-label="Reps" placeholder="Reps" type="number" min="1" aria-invalid={e?.reps ? true : undefined} {...register(`exercises.${index}.reps`)} />
                    <Input aria-label="Weight (kg)" placeholder="kg" type="number" min="0" step="0.5" aria-invalid={e?.weightKg ? true : undefined} {...register(`exercises.${index}.weightKg`)} />
                    <Input aria-label="Rest (seconds)" placeholder="Rest s" type="number" min="0" aria-invalid={e?.restSeconds ? true : undefined} {...register(`exercises.${index}.restSeconds`)} />
                    <Button variant="ghost" size="icon" aria-label={`Remove exercise ${index + 1}`} onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Input className="mt-2" aria-label={`Exercise ${index + 1} notes`} placeholder="Notes (optional), e.g. hold 45 seconds" {...register(`exercises.${index}.notes`)} />
                  {firstError && <p className="mt-1.5 text-xs font-medium text-danger">{firstError}</p>}
                </div>
              )
            })}
          </div>
          <Button variant="secondary" size="sm" className="mt-3" leftIcon={<Plus className="size-4" />} onClick={() => append(blankExercise(fields.length ? undefined : 'Monday'))} disabled={fields.length >= 60}>
            Add exercise
          </Button>
        </fieldset>
      </form>
    </Modal>
  )
}
