import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, PasswordInput } from '@/components/ui/Input'
import { applyServerErrors } from '@/lib/forms'
import { emailSchema, passwordSchema } from '@/lib/validation'

function BackToSignIn() {
  return (
    <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" />
      Back to sign in
    </Link>
  )
}

// ---------- Forgot password ----------

const forgotSchema = z.object({ email: emailSchema })

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await authApi.forgotPassword(email)
      setSentTo(email)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  if (sentTo) {
    // Same message whether or not the account exists: the API never reveals which emails are registered.
    return (
      <div>
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
          <Mail className="size-6" />
        </div>
        <h1 className="text-3xl font-bold text-fg">Check your email</h1>
        <p className="mt-3 text-sm text-muted">
          If an account exists for <span className="font-semibold text-fg">{sentTo}</span>, we've sent a link to reset your password. The link
          works once and expires in 30 minutes.
        </p>
        <BackToSignIn />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-fg">Forgot your password?</h1>
      <p className="mt-2 text-sm text-muted">Enter your email and we'll send you a reset link.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input {...fieldProps('email', errors.email?.message)} type="email" autoComplete="email" leftIcon={<Mail className="size-4" />} {...register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <BackToSignIn />
    </div>
  )
}

// ---------- Reset password (from the emailed link) ----------

const resetSchema = z
  .object({ newPassword: passwordSchema, confirmNewPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmNewPassword, { path: ['confirmNewPassword'], message: 'Passwords do not match.' })

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { newPassword: '', confirmNewPassword: '' } })

  const newPassword = useWatch({ control, name: 'newPassword' })

  if (!email || !token) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-fg">Invalid reset link</h1>
        <Alert tone="warning" className="mt-6">
          This link is incomplete. Request a new one from the{' '}
          <Link to="/forgot-password" className="font-semibold text-accent-text underline">
            forgot password
          </Link>{' '}
          page.
        </Alert>
        <BackToSignIn />
      </div>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.resetPassword({ email, token, ...values })
      toast.success('Password updated. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <div>
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <KeyRound className="size-6" />
      </div>
      <h1 className="text-3xl font-bold text-fg">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">
        For <span className="font-semibold text-fg">{email}</span>. You'll be signed out on all devices.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && (
          <Alert tone="danger">
            {formError}{' '}
            <Link to="/forgot-password" className="font-semibold text-accent-text underline">
              Request a new link
            </Link>
          </Alert>
        )}
        <Field id="newPassword" label="New password" error={errors.newPassword?.message} hint={<PasswordChecklist value={newPassword} />}>
          <PasswordInput {...fieldProps('newPassword', errors.newPassword?.message)} autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field id="confirmNewPassword" label="Confirm new password" error={errors.confirmNewPassword?.message}>
          <PasswordInput {...fieldProps('confirmNewPassword', errors.confirmNewPassword?.message)} autoComplete="new-password" {...register('confirmNewPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  )
}
