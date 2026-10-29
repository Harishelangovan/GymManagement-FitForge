import { zodResolver } from '@hookform/resolvers/zod'
import { Dices } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { membersApi, type CreateMemberInput, type Gender, type MemberDetail, type MemberProfileInput } from '@/api/resources'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchTrainers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { applyServerErrors } from '@/lib/forms'
import { generateTemporaryPassword } from '@/lib/passwords'
import { numberOrNull, orNull } from '@/lib/status'
import { emailSchema, passwordSchema, phoneSchema } from '@/lib/validation'

// ---------- Profile (member self-service and admin edit) ----------

const optionalNumber = (min: number, max: number, label: string) =>
  z.string().refine((v) => v === '' || (Number(v) >= min && Number(v) <= max), `${label} must be between ${min} and ${max}.`)

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  phoneNumber: phoneSchema,
  dateOfBirth: z.string(),
  gender: z.string(),
  heightCm: optionalNumber(50, 250, 'Height'),
  weightKg: optionalNumber(20, 300, 'Weight'),
  fitnessGoal: z.string().max(500),
  emergencyContactName: z.string().max(150),
  emergencyContactPhone: phoneSchema,
})
type ProfileValues = z.infer<typeof profileSchema>

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' },
  { value: 'PreferNotToSay', label: 'Prefer not to say' },
]

function toValues(m: MemberDetail): ProfileValues {
  return {
    firstName: m.firstName,
    lastName: m.lastName,
    phoneNumber: m.phoneNumber ?? '',
    dateOfBirth: m.dateOfBirth ?? '',
    gender: m.gender ?? '',
    heightCm: m.heightCm?.toString() ?? '',
    weightKg: m.weightKg?.toString() ?? '',
    fitnessGoal: m.fitnessGoal ?? '',
    emergencyContactName: m.emergencyContactName ?? '',
    emergencyContactPhone: m.emergencyContactPhone ?? '',
  }
}

function toInput(v: ProfileValues): MemberProfileInput {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    phoneNumber: orNull(v.phoneNumber),
    dateOfBirth: orNull(v.dateOfBirth),
    gender: (orNull(v.gender) as Gender | null) ?? null,
    heightCm: numberOrNull(v.heightCm),
    weightKg: numberOrNull(v.weightKg),
    fitnessGoal: orNull(v.fitnessGoal),
    emergencyContactName: orNull(v.emergencyContactName),
    emergencyContactPhone: orNull(v.emergencyContactPhone),
  }
}

/** The fields a member may change about themselves. Email, role and trainer are not editable here. */
export function MemberProfileForm({ member, onSave }: { member: MemberDetail; onSave: (input: MemberProfileInput) => Promise<unknown> }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: toValues(member) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSave(toInput(values))
      reset(values)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  const field = (name: keyof ProfileValues) => ({ ...fieldProps(`p-${name}`, errors[name]?.message), ...register(name) })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="p-firstName" label="First name" error={errors.firstName?.message}>
          <Input autoComplete="given-name" {...field('firstName')} />
        </Field>
        <Field id="p-lastName" label="Last name" error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...field('lastName')} />
        </Field>
        <Field id="p-phoneNumber" label="Phone" error={errors.phoneNumber?.message}>
          <Input type="tel" autoComplete="tel" {...field('phoneNumber')} />
        </Field>
        <Field id="p-dateOfBirth" label="Date of birth" error={errors.dateOfBirth?.message}>
          <Input type="date" {...field('dateOfBirth')} />
        </Field>
        <Field id="p-gender" label="Gender" error={errors.gender?.message}>
          <Select {...field('gender')}>
            <option value="">Not specified</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="p-heightCm" label="Height (cm)" error={errors.heightCm?.message}>
            <Input type="number" inputMode="decimal" step="0.1" {...field('heightCm')} />
          </Field>
          <Field id="p-weightKg" label="Weight (kg)" error={errors.weightKg?.message}>
            <Input type="number" inputMode="decimal" step="0.1" {...field('weightKg')} />
          </Field>
        </div>
        <Field id="p-fitnessGoal" label="Fitness goal" error={errors.fitnessGoal?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Build strength, run a 10K" {...field('fitnessGoal')} />
        </Field>
        <Field id="p-emergencyContactName" label="Emergency contact" error={errors.emergencyContactName?.message}>
          <Input {...field('emergencyContactName')} />
        </Field>
        <Field id="p-emergencyContactPhone" label="Emergency phone" error={errors.emergencyContactPhone?.message}>
          <Input type="tel" {...field('emergencyContactPhone')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

// ---------- Create member (admin, front desk) ----------

const createSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: emailSchema,
  phoneNumber: phoneSchema,
  temporaryPassword: passwordSchema,
})
type CreateValues = z.infer<typeof createSchema>

export function CreateMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (member: MemberDetail) => void }) {
  const [trainer, setTrainer] = useState<PickerOption | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phoneNumber: '', temporaryPassword: '' },
  })

  const close = () => {
    reset()
    setTrainer(null)
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input: CreateMemberInput = { ...values, phoneNumber: orNull(values.phoneNumber), assignedTrainerId: trainer?.id ?? null }
    try {
      const member = await membersApi.create(input)
      close()
      onCreated(member)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add member"
      description="Creates a member account. Share the temporary password so they can sign in and change it."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="create-member" loading={isSubmitting}>
            Create member
          </Button>
        </>
      }
    >
      <form id="create-member" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cm-firstName" label="First name" error={errors.firstName?.message}>
            <Input {...fieldProps('cm-firstName', errors.firstName?.message)} {...register('firstName')} />
          </Field>
          <Field id="cm-lastName" label="Last name" error={errors.lastName?.message}>
            <Input {...fieldProps('cm-lastName', errors.lastName?.message)} {...register('lastName')} />
          </Field>
        </div>
        <Field id="cm-email" label="Email" error={errors.email?.message}>
          <Input type="email" {...fieldProps('cm-email', errors.email?.message)} {...register('email')} />
        </Field>
        <Field id="cm-phoneNumber" label="Phone (optional)" error={errors.phoneNumber?.message}>
          <Input type="tel" {...fieldProps('cm-phoneNumber', errors.phoneNumber?.message)} {...register('phoneNumber')} />
        </Field>
        <Field
          id="cm-temporaryPassword"
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
          <Input {...fieldProps('cm-temporaryPassword', errors.temporaryPassword?.message)} autoComplete="off" {...register('temporaryPassword')} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cm-trainer" className="text-sm font-medium text-fg">
            Trainer (optional)
          </label>
          <EntityPicker name="trainer-picker" inputId="cm-trainer" search={searchTrainers} value={trainer} onChange={setTrainer} placeholder="Search trainers…" />
        </div>
      </form>
    </Modal>
  )
}
