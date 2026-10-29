import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-card border border-border bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}
