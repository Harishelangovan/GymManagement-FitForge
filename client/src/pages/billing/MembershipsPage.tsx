import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BadgeCheck, Plus, TriangleAlert, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import { membershipsApi, type Membership } from '@/api/resources'
import { RecordPaymentModal, SellMembershipModal } from '@/components/forms/BillingForms'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFilters, ConfirmDialog, FilterBar, SearchInput, Segmented } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, Badge } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDate } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { MEMBERSHIP_STATE_TONE } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'

const STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'expiring', label: 'Expiring soon' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Cancelled', label: 'Cancelled' },
]

export function MembershipsPage() {
  const { page, values, set, setPage } = useListParams({ search: '', state: 'all' })
  const [sellOpen, setSellOpen] = useState(false)
  const [payFor, setPayFor] = useState<Membership | null>(null)
  const [cancelling, setCancelling] = useState<Membership | null>(null)

  const query = useQuery({
    queryKey: ['memberships', page, values],
    queryFn: () =>
      membershipsApi.list({
        page,
        pageSize: 15,
        search: values.search,
        state: ['all', 'expiring'].includes(values.state) ? undefined : values.state,
        expiringSoon: values.state === 'expiring' || undefined,
        sortBy: values.state === 'expiring' ? 'end' : undefined,
        sortDirection: values.state === 'expiring' ? 'asc' : undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const cancel = useApiMutation((m: Membership) => membershipsApi.cancel(m.id), {
    invalidate: [['memberships'], ['members'], ['member']],
    success: (m) => `${m.memberName}'s ${m.planName} membership was cancelled.`,
    onSuccess: () => setCancelling(null),
  })

  const columns: Column<Membership>[] = [
    {
      key: 'member',
      header: 'Member',
      cell: (m) => (
        <Link to={`/admin/members/${m.memberProfileId}`} className="block min-w-0">
          <span className="block truncate font-medium text-fg hover:underline">{m.memberName}</span>
          <span className="block truncate text-xs text-muted">{m.memberEmail}</span>
        </Link>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (m) => m.planName },
    {
      key: 'period',
      header: 'Period',
      hideOnMobile: true,
      cell: (m) => (
        <span className="whitespace-nowrap">
          {formatDate(m.startDate)} – {formatDate(m.endDate)}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      cell: (m) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={MEMBERSHIP_STATE_TONE[m.state]}>{m.state}</Badge>
          {m.state === 'Active' && m.daysRemaining <= 7 && (
            <span className="inline-flex items-center gap-1 text-xs text-warning">
              <TriangleAlert className="size-3" aria-hidden="true" /> {m.daysRemaining}d left
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      hideOnMobile: true,
      cell: (m) => (
        <span className="tabular-nums">
          {formatCurrency(m.amountPaid)} <span className="text-muted">/ {formatCurrency(m.priceAtPurchase)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (m) => (
        <div className="flex justify-end gap-2">
          {m.balance > 0 && m.state !== 'Cancelled' && (
            <Button size="sm" variant="secondary" leftIcon={<Wallet className="size-3.5" />} onClick={() => setPayFor(m)}>
              Collect {formatCurrency(m.balance)}
            </Button>
          )}
          {(m.state === 'Active' || m.state === 'Upcoming') && (
            <Button size="sm" variant="ghost" onClick={() => setCancelling(m)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Every membership sold, with status and what's still owed."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setSellOpen(true)}>
            Sell membership
          </Button>
        }
      />
      <FilterBar>
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Member or plan" label="Search memberships" />
        <div className="overflow-x-auto">
          <Segmented label="Status" value={values.state} options={STATE_OPTIONS} onChange={(v) => set('state', v === 'all' ? '' : v)} />
        </div>
        <ClearFilters visible={values.search !== '' || values.state !== 'all'} onClear={() => { set('search', ''); set('state', '') }} />
      </FilterBar>

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={query.data?.items}
            rowKey={(m) => m.id}
            loading={query.isPending}
            emptyIcon={BadgeCheck}
            emptyTitle="No memberships match"
            footer={query.data && <Pagination {...query.data} onPageChange={setPage} />}
          />
        </Card>
      )}

      <SellMembershipModal open={sellOpen} onClose={() => setSellOpen(false)} />
      {payFor && (
        <RecordPaymentModal
          open
          onClose={() => setPayFor(null)}
          membership={{ id: payFor.id, label: `${payFor.memberName} — ${payFor.planName}`, detail: `${formatCurrency(payFor.balance)} due`, balance: payFor.balance }}
        />
      )}
      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        loading={cancel.isPending}
        title="Cancel this membership?"
        confirmLabel="Cancel membership"
        description={
          cancelling && (
            <>
              <strong className="text-fg">{cancelling.memberName}</strong>'s {cancelling.planName} membership ({formatDate(cancelling.startDate)} – {formatDate(cancelling.endDate)}) will stop
              counting as active. Payments already recorded are kept.
            </>
          )
        }
      />
    </>
  )
}
