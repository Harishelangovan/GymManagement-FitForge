import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Dumbbell, Salad, UserX, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toApiError } from '@/api/errors'
import { dietsApi, membersApi, membershipsApi, paymentsApi, usersApi, workoutsApi, type MemberDetail, type Membership } from '@/api/resources'
import { useCurrentUser } from '@/auth/authContext'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { RecordPaymentModal, SellMembershipModal } from '@/components/forms/BillingForms'
import { MemberProfileForm } from '@/components/forms/MemberForms'
import { searchTrainers } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Controls'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { MEMBERSHIP_STATE_TONE, PAYMENT_METHOD_LABEL } from '@/lib/status'

export function MemberDetailPage() {
  const user = useCurrentUser()
  const isAdmin = user.role === 'Admin'
  const id = Number(useParams().id)
  const query = useQuery({ queryKey: ['member', id], queryFn: () => membersApi.get(id), enabled: Number.isFinite(id) })
  const back = isAdmin ? '/admin/members' : '/trainer/members'

  const backLink = (
    <Link to={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> {isAdmin ? 'All members' : 'My members'}
    </Link>
  )

  if (query.isPending) return <>{backLink}<Skeleton className="h-40" /></>
  if (query.isError) {
    // 404 also covers "not yours": the API never confirms that someone else's member exists.
    const notFound = toApiError(query.error).status === 404
    return (
      <>
        {backLink}
        <Card>
          <EmptyState icon={UserX} title={notFound ? 'Member not found' : 'Could not load this member'} description={notFound ? 'This member does not exist or is not assigned to you.' : toApiError(query.error).message} />
        </Card>
      </>
    )
  }

  const member = query.data
  return (
    <>
      {backLink}
      <MemberHeader member={member} isAdmin={isAdmin} />
      {isAdmin ? <AdminSections member={member} /> : <TrainerSections member={member} />}
    </>
  )
}

function MemberHeader({ member, isAdmin }: { member: MemberDetail; isAdmin: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const name = `${member.firstName} ${member.lastName}`
  const toggle = useApiMutation(() => usersApi.setStatus(member.userId, !member.isActive), {
    invalidate: [['member'], ['members']],
    success: member.isActive ? `${name} was deactivated and signed out everywhere.` : `${name} was reactivated.`,
    onSuccess: () => setConfirmOpen(false),
  })

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar name={name} className="size-14 text-base" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-fg sm:text-3xl">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="truncate">{member.email}</span>
            {member.currentMembership && <Badge tone={MEMBERSHIP_STATE_TONE[member.currentMembership.state]}>{member.currentMembership.state}</Badge>}
            {!member.isActive && <Badge tone="neutral">Deactivated</Badge>}
          </div>
        </div>
      </div>
      {isAdmin && (
        <>
          <Button variant={member.isActive ? 'outline' : 'primary'} onClick={() => setConfirmOpen(true)}>
            {member.isActive ? 'Deactivate account' : 'Reactivate account'}
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => toggle.mutate(undefined)}
            loading={toggle.isPending}
            destructive={member.isActive}
            title={member.isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}
            confirmLabel={member.isActive ? 'Deactivate' : 'Reactivate'}
            description={
              member.isActive
                ? 'They will be signed out on every device and cannot sign in until reactivated. Their history is kept.'
                : 'They will be able to sign in again.'
            }
          />
        </>
      )}
    </div>
  )
}

// ---------- Admin ----------

function AdminSections({ member }: { member: MemberDetail }) {
  const memberOption: PickerOption = { id: member.id, label: `${member.firstName} ${member.lastName}`, detail: member.email }
  const [sellOpen, setSellOpen] = useState(false)
  const [payFor, setPayFor] = useState<Membership | null>(null)
  const update = useApiMutation((input: Parameters<typeof membersApi.update>[1]) => membersApi.update(member.id, input), {
    invalidate: [['member'], ['members']],
    success: 'Profile saved.',
    toastErrors: false,
  })

  const memberships = useQuery({ queryKey: ['memberships', 'member', member.id], queryFn: () => membershipsApi.list({ memberId: member.id, pageSize: 50 }) })
  const payments = useQuery({ queryKey: ['payments', 'member', member.id], queryFn: () => paymentsApi.list({ memberId: member.id, pageSize: 50 }) })

  const membershipColumns: Column<Membership>[] = [
    { key: 'plan', header: 'Plan', cell: (m) => <span className="font-medium">{m.planName}</span> },
    { key: 'period', header: 'Period', cell: (m) => `${formatDate(m.startDate)} – ${formatDate(m.endDate)}` },
    { key: 'state', header: 'Status', cell: (m) => <Badge tone={MEMBERSHIP_STATE_TONE[m.state]}>{m.state}</Badge> },
    {
      key: 'balance',
      header: 'Balance',
      cell: (m) =>
        m.balance > 0 && m.state !== 'Cancelled' ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Wallet className="size-3.5" />}
            onClick={(e) => {
              e.stopPropagation()
              setPayFor(m)
            }}
          >
            {formatCurrency(m.balance)} due
          </Button>
        ) : (
          <span className="text-muted">Paid</span>
        ),
    },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <MemberProfileForm member={member} onSave={(input) => update.mutateAsync(input)} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Memberships"
            action={
              <Button size="sm" leftIcon={<BadgeCheck className="size-4" />} onClick={() => setSellOpen(true)} disabled={!member.isActive}>
                Sell membership
              </Button>
            }
          />
          <DataTable
            columns={membershipColumns}
            rows={memberships.data?.items}
            rowKey={(m) => m.id}
            loading={memberships.isPending}
            emptyIcon={BadgeCheck}
            emptyTitle="No memberships yet"
          />
        </Card>
      </div>

      <div className="space-y-6">
        <TrainerAssignmentCard member={member} />
        <Card>
          <CardHeader title="Payments" />
          {payments.isPending ? (
            <CardBody>
              <Skeleton className="h-24" />
            </CardBody>
          ) : payments.data?.items.length ? (
            <ul className="divide-y divide-border">
              {payments.data.items.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{p.planName}</p>
                    <p className="text-xs text-muted">
                      {PAYMENT_METHOD_LABEL[p.method]} · {formatDateTime(p.paidUtc)}
                    </p>
                  </div>
                  <span className="font-semibold text-fg tabular-nums">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Wallet} title="No payments yet" className="py-8" />
          )}
        </Card>
      </div>

      <SellMembershipModal open={sellOpen} onClose={() => setSellOpen(false)} member={memberOption} />
      {payFor && (
        <RecordPaymentModal
          open
          onClose={() => setPayFor(null)}
          membership={{ id: payFor.id, label: `${payFor.memberName} — ${payFor.planName}`, detail: `${formatCurrency(payFor.balance)} due`, balance: payFor.balance }}
        />
      )}
    </div>
  )
}

function TrainerAssignmentCard({ member }: { member: MemberDetail }) {
  const current: PickerOption | null = member.assignedTrainerId ? { id: member.assignedTrainerId, label: member.assignedTrainerName ?? 'Trainer' } : null
  const [choice, setChoice] = useState<PickerOption | null>(current)
  const assign = useApiMutation((trainerId: number | null) => membersApi.assignTrainer(member.id, trainerId), {
    invalidate: [['member'], ['members']],
    success: (m) => (m.assignedTrainerName ? `Assigned to ${m.assignedTrainerName}.` : 'Trainer removed.'),
  })
  const changed = (choice?.id ?? null) !== (member.assignedTrainerId ?? null)

  return (
    <Card>
      <CardHeader title="Trainer" description="The trainer who writes this member's plans." />
      <CardBody className="space-y-3">
        <EntityPicker name="trainer-picker" inputId="assign-trainer" search={searchTrainers} value={choice} onChange={setChoice} placeholder="Search trainers…" />
        <div className="flex justify-end">
          <Button size="sm" disabled={!changed} loading={assign.isPending} onClick={() => assign.mutate(choice?.id ?? null)}>
            {choice ? 'Save trainer' : 'Remove trainer'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------- Trainer ----------

function TrainerSections({ member }: { member: MemberDetail }) {
  const workouts = useQuery({ queryKey: ['workouts', 'member', member.id], queryFn: () => workoutsApi.list({ memberId: member.id, pageSize: 20 }) })
  const diets = useQuery({ queryKey: ['diets', 'member', member.id], queryFn: () => dietsApi.list({ memberId: member.id, pageSize: 20 }) })
  const details: [string, string | null][] = [
    ['Phone', member.phoneNumber],
    ['Goal', member.fitnessGoal],
    ['Height', member.heightCm ? `${member.heightCm} cm` : null],
    ['Weight', member.weightKg ? `${member.weightKg} kg` : null],
    ['Membership', member.currentMembership ? `${member.currentMembership.planName}, ends ${formatDate(member.currentMembership.endDate)}` : null],
    ['Emergency contact', member.emergencyContactName ? `${member.emergencyContactName} ${member.emergencyContactPhone ?? ''}` : null],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="h-fit">
        <CardHeader title="Profile" />
        <CardBody>
          <dl className="space-y-3 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right text-fg">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <PlanList
          title="Workout plans"
          icon={Dumbbell}
          link={`/trainer/workouts?member=${member.id}`}
          items={workouts.data?.items.map((p) => ({ id: p.id, title: p.title, detail: `${p.exercises.length} exercises · from ${formatDate(p.startDate)}`, active: p.isActive }))}
          loading={workouts.isPending}
        />
        <PlanList
          title="Diet plans"
          icon={Salad}
          link={`/trainer/diets?member=${member.id}`}
          items={diets.data?.items.map((p) => ({ id: p.id, title: p.title, detail: `${p.dailyCalories} kcal · ${p.proteinGrams} g protein`, active: p.isActive }))}
          loading={diets.isPending}
        />
      </div>
    </div>
  )
}

function PlanList({
  title,
  icon,
  link,
  items,
  loading,
}: {
  title: string
  icon: typeof Dumbbell
  link: string
  items?: { id: number; title: string; detail: string; active: boolean }[]
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Link to={link} className="text-sm font-medium text-accent-text hover:underline">
            Manage
          </Link>
        }
      />
      {loading ? (
        <CardBody>
          <Skeleton className="h-16" />
        </CardBody>
      ) : items?.length ? (
        <ul className="divide-y divide-border">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{p.title}</p>
                <p className="truncate text-xs text-muted">{p.detail}</p>
              </div>
              {p.active ? <Badge tone="success">Active</Badge> : <Badge>Past</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={icon} title="None yet" className="py-8" />
      )}
    </Card>
  )
}
