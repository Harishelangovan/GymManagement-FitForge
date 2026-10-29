import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { plansApi, type MembershipPlan } from '@/api/resources'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Controls'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { applyServerErrors } from '@/lib/forms'
import { formatCurrency } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { orNull } from '@/lib/status'

/** Admin: the plans members can buy. Price changes only affect new sales. */
export function PlansPage() {
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null)
  const query = useQuery({ queryKey: ['plans', 'all'], queryFn: () => plansApi.list(true) })

  return (
    <>
      <PageHeader
        title="Membership plans"
        description="Changing a price affects new memberships only; existing members keep the price they paid."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New plan
          </Button>
        }
      />

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : query.data.length === 0 ? (
        <Card>
          <EmptyState icon={Tags} title="No plans yet" description="Create the first plan members can buy." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {query.data.map((plan) => (
            <Card key={plan.id} className={cn('flex flex-col p-5', !plan.isActive && 'opacity-70')}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-fg">{plan.name}</h2>
                {plan.isActive ? <Badge tone="success">On sale</Badge> : <Badge>Retired</Badge>}
              </div>
              <p className="mt-3 text-3xl font-semibold text-fg">{formatCurrency(plan.price)}</p>
              <p className="text-sm text-muted">
                {plan.durationDays} days · {formatCurrency(Math.round((plan.price / plan.durationDays) * 30))} / month
              </p>
              {plan.description && <p className="mt-3 flex-1 text-sm text-muted">{plan.description}</p>}
              <div className="mt-4 border-t border-border pt-4">
                <Button size="sm" variant="secondary" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(plan)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <PlanModal plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  description: z.string().max(500),
  durationDays: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 1825, 'Enter 1–1825 days.'),
  price: z.string().refine((v) => v !== '' && Number(v) >= 0 && Math.round(Number(v) * 100) === Number(v) * 100, 'Enter a price with at most 2 decimals.'),
})
type Values = z.infer<typeof schema>

function PlanModal({ plan, onClose }: { plan: MembershipPlan | null; onClose: () => void }) {
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: plan?.name ?? '', description: plan?.description ?? '', durationDays: String(plan?.durationDays ?? 30), price: String(plan?.price ?? '') },
  })

  const save = useApiMutation(
    (v: Values) => {
      const input = { name: v.name, description: orNull(v.description), durationDays: Number(v.durationDays), price: Number(v.price), isActive }
      return plan ? plansApi.update(plan.id, input) : plansApi.create(input)
    },
    { invalidate: [['plans']], toastErrors: false, success: (p) => `${p.name} saved.`, onSuccess: onClose },
  )

  const onSubmit = handleSubmit(async (values) => {
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
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={isSubmitting}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field id="pl-name" label="Name" error={errors.name?.message}>
          <Input {...fieldProps('pl-name', errors.name?.message)} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pl-durationDays" label="Duration (days)" error={errors.durationDays?.message}>
            <Input type="number" min="1" {...fieldProps('pl-durationDays', errors.durationDays?.message)} {...register('durationDays')} />
          </Field>
          <Field id="pl-price" label="Price (₹)" error={errors.price?.message}>
            <Input type="number" min="0" step="0.01" {...fieldProps('pl-price', errors.price?.message)} {...register('price')} />
          </Field>
        </div>
        <Field id="pl-description" label="Description (optional)" error={errors.description?.message}>
          <Textarea rows={3} {...fieldProps('pl-description', errors.description?.message)} {...register('description')} />
        </Field>
        <Switch id="pl-active" checked={isActive} onChange={setIsActive} label="On sale" description="Retired plans can't be sold but stay on existing memberships." />
      </form>
    </Modal>
  )
}
