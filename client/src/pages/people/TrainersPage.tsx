import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Dices, Dumbbell, Pencil, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { trainersApi, usersApi, type Trainer } from '@/api/resources'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, FilterBar, SearchInput, Switch } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Alert, Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { applyServerErrors } from '@/lib/forms'
import { useApiMutation } from '@/lib/mutations'
import { generateTemporaryPassword } from '@/lib/passwords'
import { orNull } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'
import { emailSchema, passwordSchema, phoneSchema } from '@/lib/validation'

/** Admin: create, edit and (de)activate trainers. */
export function TrainersPage() {
  const { page, values, set, setPage } = useListParams({ search: '' })
  const [editing, setEditing] = useState<Trainer | 'new' | null>(null)
  const [toggling, setToggling] = useState<Trainer | null>(null)

  const query = useQuery({
    queryKey: ['trainers', page, values],
    queryFn: () => trainersApi.list({ page, pageSize: 12, search: values.search }),
    placeholderData: keepPreviousData,
  })

  const toggle = useApiMutation((t: Trainer) => usersApi.setStatus(t.userId, !t.isActive), {
    invalidate: [['trainers']],
    success: (u) => (u.isActive ? `${u.firstName} ${u.lastName} was reactivated.` : `${u.firstName} ${u.lastName} was deactivated.`),
    onSuccess: () => setToggling(null),
  })

  return (
    <>
      <PageHeader
        title="Trainers"
        description="Coaches who lead classes and write plans."
        actions={
          <Button leftIcon={<UserPlus className="size-4" />} onClick={() => setEditing('new')}>
            Add trainer
          </Button>
        }
      />
      <FilterBar>
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Name or specialization" label="Search trainers" />
      </FilterBar>

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={Dumbbell} title={values.search ? 'No trainers match your search' : 'No trainers yet'} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.items.map((t) => (
              <Card key={t.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={`${t.firstName} ${t.lastName}`} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">
                      {t.firstName} {t.lastName}
                    </p>
                    <p className="truncate text-sm text-muted">{t.specialization}</p>
                  </div>
                  {t.isActive ? (
                    t.isAcceptingMembers ? <Badge tone="success">Accepting</Badge> : <Badge tone="warning">Full</Badge>
                  ) : (
                    <Badge>Deactivated</Badge>
                  )}
                </div>
                {t.bio && <p className="mt-3 line-clamp-2 text-sm text-muted">{t.bio}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted">Members</dt>
                    <dd className="font-semibold text-fg">{t.assignedMemberCount}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted">Experience</dt>
                    <dd className="font-semibold text-fg">{t.yearsOfExperience} yrs</dd>
                  </div>
                </dl>
                <p className="mt-3 truncate text-xs text-muted">
                  {t.email}
                  {t.phoneNumber && ` · ${t.phoneNumber}`}
                </p>
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="secondary" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToggling(t)}>
                    {t.isActive ? 'Deactivate' : 'Reactivate'}
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

      {editing && <TrainerModal trainer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => toggling && toggle.mutate(toggling)}
        loading={toggle.isPending}
        destructive={toggling?.isActive ?? true}
        title={toggling?.isActive ? `Deactivate ${toggling.firstName}?` : `Reactivate ${toggling?.firstName}?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        description={toggling?.isActive ? 'They will be signed out everywhere and hidden from members. Their classes and plans are kept.' : 'They will be able to sign in again.'}
      />
    </>
  )
}

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: z.string(),
  phoneNumber: phoneSchema,
  temporaryPassword: z.string(),
  specialization: z.string().trim().min(1, 'Specialization is required.').max(150),
  bio: z.string().max(1000),
  yearsOfExperience: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 60, 'Enter 0–60 years.'),
})
type Values = z.infer<typeof schema>

function TrainerModal({ trainer, onClose }: { trainer: Trainer | null; onClose: () => void }) {
  const isNew = trainer === null
  const [accepting, setAccepting] = useState(trainer?.isAcceptingMembers ?? true)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    // Email and temporary password are only validated (and only shown) when creating.
    resolver: zodResolver(isNew ? schema.extend({ email: emailSchema, temporaryPassword: passwordSchema }) : schema),
    defaultValues: {
      firstName: trainer?.firstName ?? '',
      lastName: trainer?.lastName ?? '',
      email: trainer?.email ?? '',
      phoneNumber: trainer?.phoneNumber ?? '',
      temporaryPassword: '',
      specialization: trainer?.specialization ?? '',
      bio: trainer?.bio ?? '',
      yearsOfExperience: String(trainer?.yearsOfExperience ?? 0),
    },
  })

  const save = useApiMutation(
    (v: Values) => {
      const common = { firstName: v.firstName, lastName: v.lastName, phoneNumber: orNull(v.phoneNumber), specialization: v.specialization, bio: orNull(v.bio), yearsOfExperience: Number(v.yearsOfExperience) }
      return isNew
        ? trainersApi.create({ ...common, email: v.email, temporaryPassword: v.temporaryPassword })
        : trainersApi.update(trainer.id, { ...common, isAcceptingMembers: accepting })
    },
    { invalidate: [['trainers']], toastErrors: false, success: (t) => (isNew ? `${t.firstName} ${t.lastName} was added.` : 'Trainer saved.'), onSuccess: onClose },
  )

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync(values)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  const f = (name: keyof Values) => ({ ...fieldProps(`tr-${name}`, errors[name]?.message), ...register(name) })

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add trainer' : `Edit ${trainer.firstName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="trainer-form" loading={isSubmitting}>
            {isNew ? 'Create trainer' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="trainer-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tr-firstName" label="First name" error={errors.firstName?.message}>
            <Input {...f('firstName')} />
          </Field>
          <Field id="tr-lastName" label="Last name" error={errors.lastName?.message}>
            <Input {...f('lastName')} />
          </Field>
        </div>
        {isNew && (
          <Field id="tr-email" label="Email" error={errors.email?.message}>
            <Input type="email" {...f('email')} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tr-specialization" label="Specialization" error={errors.specialization?.message}>
            <Input placeholder="e.g. Strength & Conditioning" {...f('specialization')} />
          </Field>
          <Field id="tr-yearsOfExperience" label="Years of experience" error={errors.yearsOfExperience?.message}>
            <Input type="number" min="0" max="60" {...f('yearsOfExperience')} />
          </Field>
        </div>
        <Field id="tr-phoneNumber" label="Phone (optional)" error={errors.phoneNumber?.message}>
          <Input type="tel" {...f('phoneNumber')} />
        </Field>
        <Field id="tr-bio" label="Bio (optional)" error={errors.bio?.message}>
          <Textarea rows={3} {...f('bio')} />
        </Field>
        {isNew ? (
          <Field
            id="tr-temporaryPassword"
            label="Temporary password"
            error={errors.temporaryPassword?.message}
            action={
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent-text hover:underline"
                onClick={() => setValue('temporaryPassword', generateTemporaryPassword(), { shouldValidate: true })}
              >
                <Dices className="size-3.5" aria-hidden="true" /> Generate
              </button>
            }
          >
            <Input autoComplete="off" {...f('temporaryPassword')} />
          </Field>
        ) : (
          <Switch id="tr-accepting" checked={accepting} onChange={setAccepting} label="Accepting new members" description="When off, admins can't assign new members to this trainer." />
        )}
      </form>
    </Modal>
  )
}
