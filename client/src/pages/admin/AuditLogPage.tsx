import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { auditApi, type AuditLogEntry } from '@/api/resources'
import { Card } from '@/components/ui/Card'
import { ClearFilters, FilterBar, SearchInput, Segmented } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Alert, Badge, EmptyState, Skeleton, type Tone } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { useListParams } from '@/lib/useListParams'

// Action names written by the API (Phase 4 admin actions and Phase 5 security events).
const ACTIONS = [
  'auth.login_failed',
  'auth.account_locked_out',
  'auth.refresh_token_reuse',
  'auth.password_changed',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'member.created',
  'member.updated',
  'member.trainer_assigned',
  'trainer.created',
  'trainer.updated',
  'user.activated',
  'user.deactivated',
  'plan.created',
  'plan.updated',
  'membership.created',
  'membership.cancelled',
  'payment.recorded',
  'class.cancelled',
]

const SERIOUS = new Set(['auth.account_locked_out', 'auth.refresh_token_reuse'])

function actionTone(action: string): Tone {
  if (SERIOUS.has(action)) return 'danger'
  if (action === 'auth.login_failed') return 'warning'
  if (action.startsWith('auth.')) return 'info'
  return 'neutral'
}

const readable = (action: string) => action.replace('.', ' · ').replaceAll('_', ' ')

/** Admin: who did what, and security events (failed logins, lockouts, token reuse). */
export function AuditLogPage() {
  const { page, values, set, setPage } = useListParams({ category: 'all', action: '', search: '', from: '', to: '' })
  const [expanded, setExpanded] = useState<number | null>(null)

  const action = values.action || (values.category === 'security' ? 'auth.' : '')
  const query = useQuery({
    queryKey: ['audit', page, values],
    queryFn: () => auditApi.list({ page, pageSize: 25, action, search: values.search, from: values.from, to: values.to }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader title="Audit log" description="Admin actions and security events, newest first. Entries can't be edited or deleted." />
      <FilterBar>
        <Segmented
          label="Category"
          value={values.category}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'security', label: 'Security events' },
          ]}
          onChange={(v) => {
            set('action', '')
            set('category', v === 'all' ? '' : v)
          }}
        />
        <div className="w-full sm:w-60">
          <Select aria-label="Action" value={values.action} onChange={(e) => set('action', e.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.filter((a) => values.category !== 'security' || a.startsWith('auth.')).map((a) => (
              <option key={a} value={a}>
                {readable(a)}
              </option>
            ))}
          </Select>
        </div>
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Actor email or details" label="Search audit log" />
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="From date" value={values.from} onChange={(e) => set('from', e.target.value)} className="w-40" />
          <span className="text-sm text-muted">to</span>
          <Input type="date" aria-label="To date" value={values.to} onChange={(e) => set('to', e.target.value)} className="w-40" />
        </div>
        <ClearFilters
          visible={Boolean(values.action || values.search || values.from || values.to || values.category !== 'all')}
          onClear={() => ['category', 'action', 'search', 'from', 'to'].forEach((k) => set(k as 'search', ''))}
        />
      </FilterBar>

      {query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : query.isPending ? (
        <Skeleton className="h-96" />
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="No entries match" />
        </Card>
      ) : (
        <Card className={cn('overflow-hidden transition-opacity', query.isFetching && 'opacity-70')}>
          <ul className="divide-y divide-border">
            {query.data.items.map((entry) => (
              <AuditRow key={entry.id} entry={entry} open={expanded === entry.id} onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)} />
            ))}
          </ul>
          <Pagination {...query.data} onPageChange={setPage} />
        </Card>
      )}
    </>
  )
}

function AuditRow({ entry, open, onToggle }: { entry: AuditLogEntry; open: boolean; onToggle: () => void }) {
  const tone = actionTone(entry.action)
  let details = entry.details
  try {
    if (details) details = JSON.stringify(JSON.parse(details), null, 2)
  } catch {
    // Not JSON: show as stored.
  }

  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-surface-2">
        <span className="w-32 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(entry.createdUtc)}</span>
        <Badge tone={tone} className="capitalize">
          {SERIOUS.has(entry.action) && <ShieldAlert className="size-3" aria-hidden="true" />}
          {readable(entry.action)}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">
          {entry.actorName ?? <span className="text-muted">Anonymous</span>}
          <span className="text-muted">
            {' '}
            → {entry.entityType} {entry.entityId}
          </span>
        </span>
        <span className="hidden text-xs text-muted sm:inline">{entry.ipAddress ?? ''}</span>
        <ChevronDown className={cn('size-4 text-subtle transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="bg-surface-2 px-5 py-3 text-xs">
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Actor</dt>
              <dd className="text-fg">{entry.actorEmail ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">IP address</dt>
              <dd className="text-fg">{entry.ipAddress ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Record</dt>
              <dd className="break-all text-fg">
                {entry.entityType} {entry.entityId}
              </dd>
            </div>
          </dl>
          {details && <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-[11px] leading-relaxed text-fg">{details}</pre>}
        </div>
      )}
    </li>
  )
}
