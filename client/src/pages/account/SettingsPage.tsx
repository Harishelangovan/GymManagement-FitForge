import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import { membersApi } from '@/api/resources'
import { useAuth, useCurrentUser } from '@/auth/authContext'
import { MemberProfileForm } from '@/components/forms/MemberForms'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert, Avatar, Badge, Skeleton } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { PasswordInput } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { applyServerErrors } from '@/lib/forms'
import { useApiMutation } from '@/lib/mutations'
import { passwordSchema } from '@/lib/validation'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, { path: ['confirmNewPassword'], message: 'Passwords do not match.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a password you are not using now.' })

export function SettingsPage() {
  const user = useCurrentUser()
  const fullName = `${user.firstName} ${user.lastName}`

  return (
    <>
      <PageHeader title="Account settings" description="Your sign-in details and security." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <CardHeader title="Profile" description="Contact the front desk to change your email." />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={fullName} className="size-14 text-base" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-fg">{fullName}</p>
                <Badge tone="accent">{user.role}</Badge>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-subtle" aria-hidden="true" />
                <dt className="sr-only">Email</dt>
                <dd className="truncate text-fg">{user.email}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <ChangePasswordCard />
      </div>
      {user.role === 'Member' && <MemberDetailsCard />}
    </>
  )
}

/** Members edit their own personal details here (the API only accepts the permitted fields). */
function MemberDetailsCard() {
  const user = useCurrentUser()
  const { updateUser } = useAuth()
  const member = useQuery({ queryKey: ['member', 'me'], queryFn: membersApi.mine })
  const save = useApiMutation(membersApi.updateMine, {
    invalidate: [['member']],
    toastErrors: false,
    success: 'Your details were saved.',
    // Keep the name in the top bar in sync.
    onSuccess: (m) => updateUser({ ...user, firstName: m.firstName, lastName: m.lastName }),
  })

  return (
    <Card className="mt-6">
      <CardHeader title="Your details" description="Shared with your trainer to plan your training. Only you and gym staff can see them." />
      <CardBody>{member.isPending ? <Skeleton className="h-64" /> : member.isError ? <Alert tone="danger">{errorMessage(member.error)}</Alert> : <MemberProfileForm member={member.data} onSave={(input) => save.mutateAsync(input)} />}</CardBody>
    </Card>
  )
}

function ChangePasswordCard() {
  const { clearSession } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  })

  const newPassword = useWatch({ control, name: 'newPassword' })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.changePassword(values)
      // The API has already ended every session (including this one), so sign in again.
      clearSession()
      toast.success('Password changed. Please sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent-text" aria-hidden="true" /> Change password
          </span>
        }
        description="You'll be signed out on all devices afterwards."
      />
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
            <PasswordInput {...fieldProps('currentPassword', errors.currentPassword?.message)} autoComplete="current-password" {...register('currentPassword')} />
          </Field>
          <Field id="newPassword" label="New password" error={errors.newPassword?.message} hint={<PasswordChecklist value={newPassword} />}>
            <PasswordInput {...fieldProps('newPassword', errors.newPassword?.message)} autoComplete="new-password" {...register('newPassword')} />
          </Field>
          <Field id="confirmNewPassword" label="Confirm new password" error={errors.confirmNewPassword?.message}>
            <PasswordInput {...fieldProps('confirmNewPassword', errors.confirmNewPassword?.message)} autoComplete="new-password" {...register('confirmNewPassword')} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
