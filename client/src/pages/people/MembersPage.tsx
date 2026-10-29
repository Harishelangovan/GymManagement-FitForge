import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { membersApi, type MemberListItem } from '@/api/resources'
import { useCurrentUser } from '@/auth/authContext'
import { CreateMemberModal } from '@/components/forms/MemberForms'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FilterBar, SearchInput, Segmented } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, Avatar, Badge } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { errorMessage } from '@/api/errors'
import { formatDate } from '@/lib/format'
import { MEMBERSHIP_STATE_TONE } from '@/lib/status'
import { useListParams } from '@/lib/useListParams'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
  { value: 'all', label: 'All' },
]

/** Admin: every member, with create. Trainer: only their assigned members (the API enforces this). */
export function MembersPage() {
  const user = useCurrentUser()
  const isAdmin = user.role === 'Admin'
  const base = isAdmin ? '/admin/members' : '/trainer/members'
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { page, values, set, setPage } = useListParams({ search: '', status: 'active' })

  const query = useQuery({
    queryKey: ['members', page, values],
    queryFn: () =>
      membersApi.list({ page, pageSize: 15, search: values.search, isActive: values.status === 'all' ? undefined : values.status === 'active', sortBy: 'name' }),
    placeholderData: keepPreviousData,
  })

  const columns: Column<MemberListItem>[] = [
    {
      key: 'name',
      header: 'Member',
      cell: (m) => (
        <Link to={`${base}/${m.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Avatar name={`${m.firstName} ${m.lastName}`} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg hover:underline">
              {m.firstName} {m.lastName}
            </span>
            <span className="block truncate text-xs text-muted">{m.email}</span>
          </span>
        </Link>
      ),
    },
    ...(isAdmin
      ? [{ key: 'trainer', header: 'Trainer', hideOnMobile: true, cell: (m: MemberListItem) => m.assignedTrainerName ?? <span className="text-muted">—</span> }]
      : []),
    {
      key: 'membership',
      header: 'Membership',
      cell: (m) =>
        m.currentMembership ? (
          <div>
            <Badge tone={MEMBERSHIP_STATE_TONE[m.currentMembership.state]}>{m.currentMembership.state}</Badge>
            <p className="mt-1 text-xs text-muted">
              {m.currentMembership.planName} · ends {formatDate(m.currentMembership.endDate)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted">None</span>
        ),
    },
    { key: 'joined', header: 'Joined', hideOnMobile: true, cell: (m) => formatDate(m.joinedOn) },
    {
      key: 'status',
      header: 'Account',
      hideOnMobile: true,
      cell: (m) => (m.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>),
    },
  ]

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Members' : 'My members'}
        description={isAdmin ? 'Everyone with a member account.' : 'Members assigned to you.'}
        actions={
          isAdmin && (
            <Button leftIcon={<UserPlus className="size-4" />} onClick={() => setCreateOpen(true)}>
              Add member
            </Button>
          )
        }
      />

      <FilterBar>
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Name, email or phone" label="Search members" />
        {isAdmin && <Segmented label="Account status" value={values.status} options={STATUS_OPTIONS} onChange={(v) => set('status', v === 'active' ? '' : v)} />}
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
            onRowClick={(m) => navigate(`${base}/${m.id}`)}
            emptyIcon={Users}
            emptyTitle={values.search ? 'No members match your search' : isAdmin ? 'No members yet' : 'No members assigned to you yet'}
            emptyDescription={values.search ? 'Try a different name, email or phone number.' : undefined}
            footer={query.data && <Pagination {...query.data} onPageChange={setPage} />}
          />
        </Card>
      )}

      {isAdmin && (
        <CreateMemberModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(m) => {
            toast.success(`${m.firstName} ${m.lastName} was added.`)
            navigate(`${base}/${m.id}`)
          }}
        />
      )}
    </>
  )
}
