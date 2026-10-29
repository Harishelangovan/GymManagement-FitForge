import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { paymentsApi, type Payment, type PaymentMethod } from '@/api/resources'
import { useCurrentUser } from '@/auth/authContext'
import { RecordPaymentModal } from '@/components/forms/BillingForms'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFilters, FilterBar, SearchInput } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, Badge } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { PAYMENT_METHOD_LABEL } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'

/** Admin: every payment with filters and recording. Member: their own payment history. */
export function PaymentsPage() {
  const user = useCurrentUser()
  const isAdmin = user.role === 'Admin'
  const { page, values, set, setPage } = useListParams({ search: '', method: '', from: '', to: '' })
  const [recordOpen, setRecordOpen] = useState(false)

  const query = useQuery({
    queryKey: ['payments', isAdmin ? 'all' : 'mine', page, values],
    queryFn: () =>
      isAdmin
        ? paymentsApi.list({ page, pageSize: 15, search: values.search, method: values.method, from: values.from, to: values.to })
        : paymentsApi.mine({ page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  })

  const total = query.data?.items.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const filtered = Object.values(values).some(Boolean)

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap">{formatDateTime(p.paidUtc)}</span> },
    ...(isAdmin ? [{ key: 'member', header: 'Member', cell: (p: Payment) => <span className="font-medium">{p.memberName}</span> }] : []),
    { key: 'plan', header: 'Plan', hideOnMobile: true, cell: (p) => p.planName },
    { key: 'method', header: 'Method', cell: (p) => <Badge>{PAYMENT_METHOD_LABEL[p.method]}</Badge> },
    { key: 'reference', header: 'Reference', hideOnMobile: true, cell: (p) => p.referenceNumber ?? <span className="text-muted">—</span> },
    ...(isAdmin ? [{ key: 'by', header: 'Recorded by', hideOnMobile: true, cell: (p: Payment) => p.recordedByName }] : []),
    { key: 'amount', header: 'Amount', className: 'text-right', cell: (p) => <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span> },
  ]

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Payments' : 'My payments'}
        description={isAdmin ? 'Front-desk payments against memberships.' : 'Every payment recorded on your memberships.'}
        actions={
          isAdmin && (
            <Button leftIcon={<Plus className="size-4" />} onClick={() => setRecordOpen(true)}>
              Record payment
            </Button>
          )
        }
      />

      {isAdmin && (
        <FilterBar>
          <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Member or reference" label="Search payments" />
          <div className="w-full sm:w-44">
            <Select aria-label="Payment method" value={values.method} onChange={(e) => set('method', e.target.value)}>
              <option value="">All methods</option>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From date" value={values.from} onChange={(e) => set('from', e.target.value)} className="w-40" />
            <span className="text-sm text-muted">to</span>
            <Input type="date" aria-label="To date" value={values.to} onChange={(e) => set('to', e.target.value)} className="w-40" />
          </div>
          <ClearFilters visible={filtered} onClear={() => ['search', 'method', 'from', 'to'].forEach((k) => set(k as 'search', ''))} />
        </FilterBar>
      )}

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : (
        <Card className="overflow-hidden">
          {query.data && query.data.items.length > 0 && (
            <p className="border-b border-border px-5 py-3 text-sm text-muted">
              {query.data.totalCount} payment{query.data.totalCount === 1 ? '' : 's'} · <span className="font-semibold text-fg">{formatCurrency(total)}</span> on this page
            </p>
          )}
          <DataTable
            columns={columns}
            rows={query.data?.items}
            rowKey={(p) => p.id}
            loading={query.isPending}
            emptyIcon={Wallet}
            emptyTitle={filtered ? 'No payments match these filters' : 'No payments yet'}
            footer={query.data && <Pagination {...query.data} onPageChange={setPage} />}
          />
        </Card>
      )}

      {isAdmin && <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} />}
    </>
  )
}
