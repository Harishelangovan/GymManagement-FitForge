import { ChartColumn, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface ChartCardProps {
  title: string
  description?: string
  /** Legend for 2+ series (a single series is named by the title). */
  legend?: ReactNode
  chart: ReactNode
  /** The same numbers as an accessible table: every value is readable without hovering. */
  table: ReactNode
  className?: string
}

/** Card with a Chart / Table switch. Tooltips enhance the chart; the table view never depends on them. */
export function ChartCard({ title, description, legend, chart, table, className }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label={`${title} view`}>
            {(['chart', 'table'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  view === option ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {option === 'chart' ? <ChartColumn className="size-3.5" aria-hidden="true" /> : <Table2 className="size-3.5" aria-hidden="true" />}
                {option === 'chart' ? 'Chart' : 'Table'}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 px-5 pt-4 pb-5">
        {view === 'chart' ? (
          <>
            {legend && <div className="mb-3">{legend}</div>}
            {chart}
          </>
        ) : (
          <div className="max-h-72 overflow-auto">{table}</div>
        )}
      </div>
    </Card>
  )
}

/** Legend entry: a swatch in the series colour beside text in normal ink (text never wears the data colour). */
export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Simple, aligned data table for the Table view. */
export function DataTableView({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-border text-left text-xs text-subtle">
          {headers.map((header, i) => (
            <th key={header} scope="col" className={cn('py-2 font-semibold', i > 0 && 'text-right')}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={String(row[0])}>
            {row.map((cell, i) => (
              <td key={i} className={cn('py-2 text-fg', i > 0 && 'text-right tabular-nums')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
