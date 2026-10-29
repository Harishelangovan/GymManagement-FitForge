import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { fieldProps } from '@/components/ui/fieldProps'
import { Input, PasswordInput } from '@/components/ui/Input'
import { applyServerErrors } from '@/lib/forms'
import { emailSchema } from '@/lib/validation'

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
})
type Values = z.infer<typeof schema>

// Shown only in development builds, to make trying the three roles quick.
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@fitforge.test' },
  { role: 'Trainer', email: 'arjun.trainer@fitforge.test' },
  { role: 'Member', email: 'rahul.member@fitforge.test' },
]

export function LoginPage() {
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      // <GuestOnly> redirects as soon as the session exists (back to the page that needed sign-in, or home).
      const user = await login(values)
      toast.success(`Welcome back, ${user.firstName}!`)
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-fg">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Welcome back. Enter your details to continue.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldProps('email', errors.email?.message)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="size-4" />}
            {...register('email')}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          error={errors.password?.message}
          action={
            <Link to="/forgot-password" className="text-xs font-medium text-accent-text hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput {...fieldProps('password', errors.password?.message)} autoComplete="current-password" {...register('password')} />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
          {!isSubmitting && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to FitForge?{' '}
        <Link to="/register" className="font-semibold text-accent-text hover:underline">
          Create a member account
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-4">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Development demo accounts</p>
          <p className="mt-1 text-xs text-muted">Passwords are the ones you set with dotnet user-secrets.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button key={account.role} variant="secondary" size="sm" onClick={() => setValue('email', account.email, { shouldValidate: true })}>
                {account.role}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
