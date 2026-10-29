import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  /** Small text under the value, e.g. "of 6 members". */
  hint?: ReactNode
  /** Signed change vs a named period, e.g. { value: 72.7, period: 'vs last month' }. */
  delta?: { value: number; period: string; upIsGood?: boolean } | null
  /** Highlights the tile when something needs attention (always with the icon + text, never colour alone). */
  tone?: 'default' | 'warning'
}

/** KPI tile: label, value (proportional figures), optional delta and hint. */
export function StatCard({ label, value, icon: Icon, hint, delta, tone = 'default' }: StatCardProps) {
  const deltaGood = delta && (delta.upIsGood ?? true) === delta.value >= 0

  return (
    <Card className={cn('p-5', tone === 'warning' && 'border-warning/40')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl',
            tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent-text',
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-sans text-3xl font-semibold tracking-tight text-fg">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {delta && Number.isFinite(delta.value) && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', deltaGood ? 'text-success' : 'text-danger')}>
            {delta.value >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
            {delta.value >= 0 ? '+' : ''}
            {delta.value.toFixed(1)}%<span className="sr-only">{delta.value >= 0 ? ' increase' : ' decrease'}</span>
          </span>
        )}
        {delta && <span className="text-muted">{delta.period}</span>}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  )
}
