import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FieldProps {
  /** Must match the id of the input inside, so the label is announced by screen readers. */
  id: string
  label: string
  error?: string
  hint?: ReactNode
  /** Right side of the label row, e.g. a "Forgot password?" link. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Label + control + hint/error. Give the input `aria-invalid` and `aria-describedby={`${id}-error`}`
 * (the `fieldProps` helper does this) so the error is linked to the field.
 */
export function Field({ id, label, error, hint, action, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  )
}
