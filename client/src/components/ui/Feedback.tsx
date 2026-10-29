import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ---------- Badge ----------

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', BADGE_TONES[tone], className)}
      {...props}
    />
  )
}

// ---------- Alert ----------

const ALERT_STYLES: Record<Exclude<Tone, 'neutral' | 'accent'>, { classes: string; icon: LucideIcon }> = {
  success: { classes: 'border-success/30 bg-success-soft text-success', icon: CircleCheck },
  warning: { classes: 'border-warning/30 bg-warning-soft text-warning', icon: TriangleAlert },
  danger: { classes: 'border-danger/30 bg-danger-soft text-danger', icon: CircleX },
  info: { classes: 'border-info/30 bg-info-soft text-info', icon: Info },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_STYLES
  title?: string
  children?: ReactNode
  className?: string
}) {
  const { classes, icon: Icon } = ALERT_STYLES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', classes, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-muted')}>{children}</div>}
      </div>
    </div>
  )
}

// ---------- Skeleton ----------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-3', className)} aria-hidden="true" />
}

// ---------- Empty state ----------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ---------- Avatar ----------

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span
      className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-text', className)}
      aria-hidden="true"
    >
      {letters}
    </span>
  )
}
