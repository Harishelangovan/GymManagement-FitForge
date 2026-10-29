import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const inputClasses =
  'h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-fg placeholder:text-subtle ' +
  'transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/40'

export interface InputProps extends ComponentProps<'input'> {
  leftIcon?: ReactNode
}

export function Input({ className, leftIcon, ...props }: InputProps) {
  if (!leftIcon) return <input className={cn(inputClasses, className)} {...props} />

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">{leftIcon}</span>
      <input className={cn(inputClasses, 'pl-10', className)} {...props} />
    </div>
  )
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} className={cn(inputClasses, 'pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-1 my-1 grid w-9 cursor-pointer place-items-center rounded-lg text-subtle hover:text-fg"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClasses, 'h-auto min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cn(inputClasses, 'cursor-pointer appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-subtle" aria-hidden="true" />
    </div>
  )
}
