import { z } from 'zod'

// Mirrors the API's rules (Application/Validators) so users see problems before submitting.
// The API still validates everything; these are for a better experience, not for security.

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'A number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'A symbol', test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
] as const

export const passwordSchema = z
  .string()
  .max(128, 'Password is too long.')
  .refine((v) => PASSWORD_RULES.every((rule) => rule.test(v)), 'Password does not meet all the requirements.')

export const emailSchema = z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.'))

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\+?[0-9 -]{7,20}$/.test(v), 'Enter a valid phone number.')
