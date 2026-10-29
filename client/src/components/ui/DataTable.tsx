import { ChevronLeft, ChevronRight, Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { EmptyState, Skeleton } from './Feedback'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  /** Hide on small screens to keep tables readable on phones. */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  footer?: ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyIcon = Inbox,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  onRowClick,
  footer,
}: DataTableProps<T>) {
  const responsive = (column: Column<T>) => cn(column.hideOnMobile && 'hidden md:table-cell', column.className)

  if (!loading && rows?.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div>
      {/* The table scrolls sideways inside its card; the page itself never scrolls horizontally. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-subtle uppercase">
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn('px-5 py-3 font-semibold', responsive(column))}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((column) => (
                      <td key={column.key} className={cn('px-5 py-3.5', responsive(column))}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-2')}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={cn('px-5 py-3.5 text-fg', responsive(column))}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, totalCount, pageSize, onPageChange }: PaginationProps) {
  if (totalCount === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <nav className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm" aria-label="Pagination">
      <p className="text-muted">
        <span className="font-medium text-fg">{from}</span>–<span className="font-medium text-fg">{to}</span> of{' '}
        <span className="font-medium text-fg">{totalCount}</span>
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} leftIcon={<ChevronLeft className="size-4" />}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
