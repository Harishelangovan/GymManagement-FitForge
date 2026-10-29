import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '@/auth/authContext'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, PasswordInput } from '@/components/ui/Input'
import { applyServerErrors } from '@/lib/forms'
import { emailSchema, passwordSchema, phoneSchema } from '@/lib/validation'

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    email: emailSchema,
    phoneNumber: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
type Values = z.infer<typeof schema>

/** Public sign-up. The account is always a Member: the form has no role field and the API ignores one. */
export function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' },
  })

  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      // <GuestOnly> redirects to the new member's dashboard as soon as the session exists.
      const user = await registerAccount(values)
      toast.success(`Welcome to FitForge, ${user.firstName}!`)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-fg">Create your account</h1>
      <p className="mt-2 text-sm text-muted">Join as a member to book classes and follow your plans.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="First name" error={errors.firstName?.message}>
            <Input {...fieldProps('firstName', errors.firstName?.message)} autoComplete="given-name" {...register('firstName')} />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName?.message}>
            <Input {...fieldProps('lastName', errors.lastName?.message)} autoComplete="family-name" {...register('lastName')} />
          </Field>
        </div>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input {...fieldProps('email', errors.email?.message)} type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field id="phoneNumber" label="Phone (optional)" error={errors.phoneNumber?.message}>
          <Input {...fieldProps('phoneNumber', errors.phoneNumber?.message)} type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('phoneNumber')} />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message} hint={<PasswordChecklist value={password} />}>
          <PasswordInput {...fieldProps('password', errors.password?.message)} autoComplete="new-password" {...register('password')} />
        </Field>

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput {...fieldProps('confirmPassword', errors.confirmPassword?.message)} autoComplete="new-password" {...register('confirmPassword')} />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already a member?{' '}
        <Link to="/login" className="font-semibold text-accent-text hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
