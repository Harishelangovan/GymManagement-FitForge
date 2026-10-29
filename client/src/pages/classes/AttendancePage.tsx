import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ClipboardCheck, LogIn } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { attendanceApi, type AttendanceRecord } from '@/api/resources'
import { useCurrentUser } from '@/auth/authContext'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchMembers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFilters, FilterBar, SearchInput } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, Badge } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { useListParams } from '@/lib/useListParams'

/**
 * Admin: all attendance. Trainer: their members' check-ins and their classes (API-enforced).
 * Member: their own visits. Class attendance is marked from the class roster; gym check-ins here.
 */
export function AttendancePage() {
  const user = useCurrentUser()
  const isMember = user.role === 'Member'
  const { page, values, set, setPage } = useListParams({ search: '', from: '', to: '' })
  const [checkInOpen, setCheckInOpen] = useState(false)

  const query = useQuery({
    queryKey: ['attendance', isMember ? 'mine' : 'all', page, values],
    queryFn: () =>
      isMember ? attendanceApi.mine({ page, pageSize: 20 }) : attendanceApi.list({ page, pageSize: 20, search: values.search, from: values.from, to: values.to }),
    placeholderData: keepPreviousData,
  })

  const columns: Column<AttendanceRecord>[] = [
    { key: 'when', header: 'When', cell: (a) => <span className="whitespace-nowrap">{formatDateTime(a.checkInUtc)}</span> },
    ...(!isMember ? [{ key: 'member', header: 'Member', cell: (a: AttendanceRecord) => <span className="font-medium">{a.memberName}</span> }] : []),
    { key: 'type', header: 'Visit', cell: (a) => (a.classTitle ? <Badge tone="info">{a.classTitle}</Badge> : <Badge>Gym check-in</Badge>) },
    { key: 'by', header: 'Marked by', hideOnMobile: true, cell: (a) => a.markedByName },
  ]

  return (
    <>
      <PageHeader
        title={isMember ? 'My attendance' : 'Attendance'}
        description={isMember ? 'Every gym visit and class you attended.' : 'Class attendance is marked from each class roster; gym check-ins here.'}
        actions={
          !isMember && (
            <Button leftIcon={<LogIn className="size-4" />} onClick={() => setCheckInOpen(true)}>
              Check in member
            </Button>
          )
        }
      />

      {!isMember && (
        <FilterBar>
          <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Member name" label="Search attendance" />
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From date" value={values.from} onChange={(e) => set('from', e.target.value)} className="w-40" />
            <span className="text-sm text-muted">to</span>
            <Input type="date" aria-label="To date" value={values.to} onChange={(e) => set('to', e.target.value)} className="w-40" />
          </div>
          <ClearFilters visible={Object.values(values).some(Boolean)} onClear={() => { set('search', ''); set('from', ''); set('to', '') }} />
        </FilterBar>
      )}

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={query.data?.items}
            rowKey={(a) => a.id}
            loading={query.isPending}
            emptyIcon={ClipboardCheck}
            emptyTitle={isMember ? 'No visits yet' : 'No attendance matches'}
            footer={query.data && <Pagination {...query.data} onPageChange={setPage} />}
          />
        </Card>
      )}

      {checkInOpen && <CheckInModal onClose={() => setCheckInOpen(false)} />}
    </>
  )
}

function CheckInModal({ onClose }: { onClose: () => void }) {
  const [member, setMember] = useState<PickerOption | null>(null)
  const checkIn = useApiMutation((m: PickerOption) => attendanceApi.mark(m.id, null), {
    invalidate: [['attendance']],
    success: (a) => `${a.memberName} checked in.`,
    onSuccess: onClose,
  })

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Check in member"
      description="Records a gym visit for today. Requires an active membership; once per day."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!member} loading={checkIn.isPending} onClick={() => member && checkIn.mutate(member)}>
            Check in
          </Button>
        </>
      }
    >
      <label htmlFor="ci-member" className="mb-1.5 block text-sm font-medium text-fg">
        Member
      </label>
      <EntityPicker name="member-picker" inputId="ci-member" search={searchMembers} value={member} onChange={setMember} placeholder="Search members…" />
    </Modal>
  )
}
