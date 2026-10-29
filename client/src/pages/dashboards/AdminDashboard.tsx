import { useQuery } from '@tanstack/react-query'
import {
  CalendarPlus,
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  Hourglass,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router'
import { dashboardApi, type AdminDashboard as AdminData } from '@/api/dashboard'
import { useCurrentUser } from '@/auth/authContext'
import { ChartCard, DataTableView } from '@/components/charts/ChartCard'
import { ColumnChart } from '@/components/charts/Charts'
import { StatusBar } from '@/components/charts/StatusBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Avatar, Badge } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { formatCurrency, formatCurrencyCompact, formatDate, formatDateTime, formatMonth } from '@/lib/format'
import { greeting, percentChange, todayLabel } from '@/lib/time'
import { AttendanceChartCard, DashboardError, DashboardSkeleton, ListCard } from './shared'

const QUICK_ACTIONS = [
  { label: 'Add member', to: '/admin/members', icon: UserPlus },
  { label: 'Record payment', to: '/admin/payments', icon: CreditCard },
  { label: 'Schedule class', to: '/admin/classes', icon: CalendarPlus },
]

export function AdminDashboard() {
  const user = useCurrentUser()
  const query = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: dashboardApi.admin })

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.firstName}`}
        description={`Gym overview for ${todayLabel()}`}
        actions={QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
          >
            <action.icon className="size-4 text-accent-text" aria-hidden="true" />
            {action.label}
          </Link>
        ))}
      />

      {query.isPending ? (
        <DashboardSkeleton tiles={5} />
      ) : query.isError ? (
        <DashboardError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        // While refetching, keep the previous numbers visible (dimmed) instead of flashing skeletons.
        <div className={cn('space-y-6 transition-opacity', query.isFetching && 'opacity-70')}>
          <AdminContent data={query.data} />
        </div>
      )}
    </>
  )
}

function AdminContent({ data }: { data: AdminData }) {
  const { kpis } = data
  const revenueDelta = percentChange(kpis.revenueThisMonth, kpis.revenueLastMonth)

  return (
    <>
      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active members" value={kpis.activeMembers} icon={Users} hint={`of ${kpis.totalMembers} members`} />
        <StatCard
          label="Revenue this month"
          value={formatCurrency(kpis.revenueThisMonth)}
          icon={Wallet}
          delta={revenueDelta === null ? null : { value: revenueDelta, period: 'vs last month' }}
          hint={revenueDelta === null ? `${formatCurrency(kpis.outstandingBalance)} outstanding` : undefined}
        />
        <StatCard
          label="Expiring in 7 days"
          value={kpis.expiringSoon}
          icon={kpis.expiringSoon > 0 ? TriangleAlert : Hourglass}
          tone={kpis.expiringSoon > 0 ? 'warning' : 'default'}
          hint={kpis.expiringSoon > 0 ? 'need a renewal' : 'nothing due'}
        />
        <StatCard label="Check-ins today" value={kpis.checkInsToday} icon={ClipboardCheck} hint={`${kpis.classesToday} classes scheduled`} />
        <StatCard label="Active trainers" value={kpis.activeTrainers} icon={Dumbbell} hint={`${formatCurrency(kpis.outstandingBalance)} dues open`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Revenue"
          description="Payments received per month, last 12 months"
          chart={
            <ColumnChart
              seriesName="Revenue"
              formatValue={formatCurrency}
              formatTick={formatCurrencyCompact}
              data={data.revenueByMonth.map((m) => ({ key: m.month, label: formatMonth(m.month), fullLabel: formatMonth(m.month, 'long'), value: m.amount }))}
            />
          }
          table={<DataTableView headers={['Month', 'Revenue']} rows={[...data.revenueByMonth].reverse().map((m) => [formatMonth(m.month, 'long'), formatCurrency(m.amount)])} />}
        />

        <Card>
          <CardHeader title="Membership status" description="Every active member, today" />
          <CardBody>
            <StatusBar
              totalLabel="members"
              segments={[
                { key: 'active', label: 'Active', value: data.membershipBreakdown.active, status: 'good', icon: CircleCheck },
                { key: 'expiring', label: 'Expiring in 7 days', value: data.membershipBreakdown.expiringSoon, status: 'warning', icon: TriangleAlert },
                { key: 'lapsed', label: 'Lapsed', value: data.membershipBreakdown.lapsed, status: 'critical', icon: CircleX },
                { key: 'notStarted', label: 'No membership yet', value: data.membershipBreakdown.notStarted, status: 'neutral', icon: CircleDashed },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="New members"
          description="Members who joined per month, last 12 months"
          chart={
            <ColumnChart
              seriesName="New members"
              formatValue={(v) => `${v} ${v === 1 ? 'member' : 'members'}`}
              data={data.newMembersByMonth.map((m) => ({ key: m.month, label: formatMonth(m.month), fullLabel: formatMonth(m.month, 'long'), value: m.count }))}
            />
          }
          table={<DataTableView headers={['Month', 'New members']} rows={[...data.newMembersByMonth].reverse().map((m) => [formatMonth(m.month, 'long'), m.count])} />}
        />
        <AttendanceChartCard days={data.attendanceByDay} title="Attendance" description="Class visits and gym check-ins, last 14 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ListCard
          title="Expiring soon"
          description="Active memberships ending within 7 days"
          emptyIcon={CircleCheck}
          emptyTitle="No renewals due"
          emptyDescription="No memberships end in the next 7 days."
          isEmpty={data.expiringMemberships.length === 0}
        >
          {data.expiringMemberships.map((m) => (
            <li key={m.membershipId} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={m.memberName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{m.memberName}</p>
                <p className="truncate text-xs text-muted">
                  {m.planName} · ends {formatDate(m.endDate)}
                </p>
              </div>
              <Badge tone="warning">
                <TriangleAlert className="size-3" aria-hidden="true" />
                {m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining}d left`}
              </Badge>
            </li>
          ))}
        </ListCard>

        <ListCard title="Recent payments" emptyIcon={Wallet} emptyTitle="No payments yet" isEmpty={data.recentPayments.length === 0}>
          {data.recentPayments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{p.memberName}</p>
                <p className="truncate text-xs text-muted">
                  {p.planName} · {p.method === 'Upi' ? 'UPI' : p.method} · {formatDateTime(p.paidUtc)}
                </p>
              </div>
              <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(p.amount)}</span>
            </li>
          ))}
        </ListCard>

        <ListCard title="New registrations" emptyIcon={UserPlus} emptyTitle="No members yet" isEmpty={data.recentRegistrations.length === 0}>
          {data.recentRegistrations.map((m) => (
            <li key={m.memberProfileId} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{m.name}</p>
                <p className="truncate text-xs text-muted">{m.trainerName ? `Trainer: ${m.trainerName}` : 'No trainer assigned'}</p>
              </div>
              <span className="text-xs text-muted">{formatDate(m.joinedOn)}</span>
            </li>
          ))}
        </ListCard>
      </div>
    </>
  )
}
