import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Salad } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { dietsApi, membersApi, type DietPlan } from '@/api/resources'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchMembers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFilters, FilterBar, Segmented, Switch } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { applyServerErrors } from '@/lib/forms'
import { useApiMutation } from '@/lib/mutations'
import { orNull } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'

/** Trainer: diet plans for assigned members. Same rules as workout plans: one active plan per member. */
export function DietPlansPage() {
  const { page, values, set, setPage } = useListParams({ member: '', status: 'active' })
  const memberId = Number(values.member) || undefined
  const [editing, setEditing] = useState<DietPlan | 'new' | null>(null)

  const member = useQuery({ queryKey: ['member', memberId], queryFn: () => membersApi.get(memberId!), enabled: Boolean(memberId) })
  const memberOption: PickerOption | null = member.data ? { id: member.data.id, label: `${member.data.firstName} ${member.data.lastName}`, detail: member.data.email } : null

  const query = useQuery({
    queryKey: ['diets', page, values],
    queryFn: () => dietsApi.list({ page, pageSize: 10, memberId, isActive: values.status === 'all' ? undefined : values.status === 'active' }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        title="Diet plans"
        description="Daily targets and meals for your members."
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
          <EmptyState icon={Salad} title="No diet plans here" action={<Button onClick={() => setEditing('new')}>New plan</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data.items.map((plan) => (
              <Card key={plan.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">{plan.memberName}</p>
                    <h2 className="truncate text-lg font-semibold text-fg">{plan.title}</h2>
                  </div>
                  {plan.isActive ? <Badge tone="success">Active</Badge> : <Badge>Retired</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-fg">{plan.dailyCalories.toLocaleString('en-IN')}</span> kcal · <span className="font-semibold text-fg">{plan.proteinGrams} g</span> protein per day
                </p>
                <dl className="mt-3 flex-1 space-y-1.5 text-sm">
                  {(
                    [
                      ['Breakfast', plan.breakfast],
                      ['Lunch', plan.lunch],
                      ['Dinner', plan.dinner],
                      ['Snacks', plan.snacks],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="flex gap-3">
                        <dt className="w-20 shrink-0 font-medium text-accent-text">{label}</dt>
                        <dd className="min-w-0 text-muted">{value}</dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-4 border-t border-border pt-4">
                  <Button size="sm" variant="secondary" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(plan)}>
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-4">
            <Pagination {...query.data} onPageChange={setPage} />
          </Card>
        </>
      )}

      {editing && <DietPlanEditor plan={editing === 'new' ? null : editing} presetMember={memberOption} onClose={() => setEditing(null)} />}
    </>
  )
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(150),
  dailyCalories: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 500 && Number(v) <= 10000, 'Enter 500–10,000 kcal.'),
  proteinGrams: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000, 'Enter 0–1000 g.'),
  breakfast: z.string().trim().min(1, 'Breakfast is required.').max(1000),
  lunch: z.string().trim().min(1, 'Lunch is required.').max(1000),
  dinner: z.string().trim().min(1, 'Dinner is required.').max(1000),
  snacks: z.string().max(1000),
  notes: z.string().max(1000),
})
type Values = z.infer<typeof schema>

function DietPlanEditor({ plan, presetMember, onClose }: { plan: DietPlan | null; presetMember: PickerOption | null; onClose: () => void }) {
  const [member, setMember] = useState<PickerOption | null>(plan ? { id: plan.memberProfileId, label: plan.memberName } : presetMember)
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: plan?.title ?? '',
      dailyCalories: String(plan?.dailyCalories ?? 2000),
      proteinGrams: String(plan?.proteinGrams ?? 100),
      breakfast: plan?.breakfast ?? '',
      lunch: plan?.lunch ?? '',
      dinner: plan?.dinner ?? '',
      snacks: plan?.snacks ?? '',
      notes: plan?.notes ?? '',
    },
  })

  const save = useApiMutation(
    (v: Values) => {
      const input = { ...v, dailyCalories: Number(v.dailyCalories), proteinGrams: Number(v.proteinGrams), snacks: orNull(v.snacks), notes: orNull(v.notes) }
      return plan ? dietsApi.update(plan.id, { ...input, isActive }) : dietsApi.create({ ...input, memberProfileId: member!.id })
    },
    { invalidate: [['diets']], toastErrors: false, success: (p) => `${p.title} saved for ${p.memberName}.`, onSuccess: onClose },
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

  const f = (name: keyof Values) => ({ ...fieldProps(`dp-${name}`, errors[name]?.message), ...register(name) })

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={plan ? `Edit ${plan.title}` : 'New diet plan'}
      description={plan ? `For ${plan.memberName}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="diet-form" loading={isSubmitting}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="diet-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        {!plan && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dp-member" className="text-sm font-medium text-fg">
              Member
            </label>
            <EntityPicker name="member-picker" inputId="dp-member" search={searchMembers} value={member} onChange={setMember} placeholder="Search your members…" />
          </div>
        )}
        <Field id="dp-title" label="Title" error={errors.title?.message}>
          <Input placeholder="e.g. Lean bulk – 2,800 kcal" {...f('title')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="dp-dailyCalories" label="Calories per day" error={errors.dailyCalories?.message}>
            <Input type="number" min="500" step="50" {...f('dailyCalories')} />
          </Field>
          <Field id="dp-proteinGrams" label="Protein per day (g)" error={errors.proteinGrams?.message}>
            <Input type="number" min="0" {...f('proteinGrams')} />
          </Field>
        </div>
        {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
          <Field key={meal} id={`dp-${meal}`} label={meal[0].toUpperCase() + meal.slice(1)} error={errors[meal]?.message}>
            <Textarea rows={2} {...f(meal)} />
          </Field>
        ))}
        <Field id="dp-snacks" label="Snacks (optional)" error={errors.snacks?.message}>
          <Textarea rows={2} {...f('snacks')} />
        </Field>
        <Field id="dp-notes" label="Notes (optional)" error={errors.notes?.message}>
          <Textarea rows={2} {...f('notes')} />
        </Field>
        {plan && <Switch id="dp-active" checked={isActive} onChange={setIsActive} label="Active plan" description="Activating this plan retires the member's other active diet plan." />}
      </form>
    </Modal>
  )
}
