import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/theme/themeContext'
import { CHART_COLORS } from './chartTheme'

export interface StatusSegment {
  key: string
  label: string
  value: number
  status: 'good' | 'warning' | 'critical' | 'neutral'
  icon: LucideIcon
}

/**
 * Part-to-whole as one 100% bar (easier to compare than a donut) with a legend that repeats every number,
 * so colour is never the only channel. Status colours are always paired with an icon and a label.
 */
export function StatusBar({ segments, totalLabel }: { segments: StatusSegment[]; totalLabel: string }) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme].status
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const percent = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100))

  return (
    <div>
      <p className="text-sm text-muted">
        <span className="text-2xl font-semibold text-fg">{total}</span> {totalLabel}
      </p>

      {/* gap-0.5 = the 2px surface gap between segments */}
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {total === 0 ? (
          <div className="h-full w-full bg-surface-3" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div key={s.key} className="h-full transition-opacity hover:opacity-80" style={{ width: `${(s.value / total) * 100}%`, backgroundColor: colors[s.status] }} title={`${s.label}: ${s.value} (${percent(s.value)}%)`} />
            ))
        )}
      </div>

      <ul className="mt-5 space-y-3">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colors[s.status] }} aria-hidden="true" />
            <s.icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="flex-1 text-fg">{s.label}</span>
            <span className="font-semibold text-fg tabular-nums">{s.value}</span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">{percent(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
