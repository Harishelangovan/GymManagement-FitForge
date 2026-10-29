import { RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DailyAttendance } from '@/api/dashboard'
import { errorMessage } from '@/api/errors'
import { ChartCard, DataTableView, LegendItem } from '@/components/charts/ChartCard'
import { CHART_COLORS } from '@/components/charts/chartTheme'
import { StackedColumnChart } from '@/components/charts/Charts'
import { StatCardSkeleton } from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { formatDay } from '@/lib/format'
import { useTheme } from '@/theme/themeContext'

/** First-load placeholder with the same layout as the real dashboard (no layout jump when data arrives). */
export function DashboardSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className={cn('grid gap-4 sm:grid-cols-2', tiles === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'xl:grid-cols-4')}>
        {Array.from({ length: tiles }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

export function DashboardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert tone="danger" title="We couldn't load your dashboard">
      <p>{errorMessage(error)}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} leftIcon={<RefreshCw className="size-3.5" />}>
        Try again
      </Button>
    </Alert>
  )
}

/** A card holding a short list, with an empty state when there's nothing to show. */
export function ListCard({
  title,
  description,
  action,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isEmpty,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription?: string
  isEmpty: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} action={action} />
      {isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} className="py-10" />
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Card>
  )
}

/** Daily attendance, stacked: class visits + gym check-ins. Used by the admin and trainer dashboards. */
export function AttendanceChartCard({ days, title, description }: { days: DailyAttendance[]; title: string; description: string }) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme]
  const firstName = 'Class visits'
  const secondName = 'Gym check-ins'

  return (
    <ChartCard
      title={title}
      description={description}
      legend={
        <div className="flex flex-wrap gap-4">
          <LegendItem color={colors.series1} label={firstName} />
          <LegendItem color={colors.series2} label={secondName} />
        </div>
      }
      chart={
        <StackedColumnChart
          firstName={firstName}
          secondName={secondName}
          data={days.map((d) => ({ key: d.date, label: formatDay(d.date), fullLabel: formatDay(d.date, 'long'), first: d.classVisits, second: d.gymCheckIns }))}
        />
      }
      table={
        <DataTableView
          headers={['Day', firstName, secondName, 'Total']}
          rows={[...days].reverse().map((d) => [formatDay(d.date, 'long'), d.classVisits, d.gymCheckIns, d.classVisits + d.gymCheckIns])}
        />
      }
    />
  )
}
