import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { membershipsApi, paymentsApi, plansApi, type PaymentMethod } from '@/api/resources'
import { EntityPicker, type PickerOption } from '@/components/EntityPicker'
import { searchMembers, searchMembershipsWithBalance } from '@/components/pickers'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { orNull, PAYMENT_METHOD_LABEL } from '@/lib/status'

// ---------- Sell a membership ----------

export function SellMembershipModal({ open, onClose, member: fixedMember }: { open: boolean; onClose: () => void; member?: PickerOption }) {
  const [member, setMember] = useState<PickerOption | null>(fixedMember ?? null)
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const plans = useQuery({ queryKey: ['plans', 'active'], queryFn: () => plansApi.list(false), enabled: open })

  const close = () => {
    setMember(fixedMember ?? null)
    setPlanId('')
    setStartDate('')
    setError(null)
    onClose()
  }

  const sell = useApiMutation(membershipsApi.create, {
    invalidate: [['memberships'], ['members'], ['member'], ['payments']],
    toastErrors: false,
    success: (m) => `${m.planName} membership created for ${m.memberName} (${m.startDate} → ${m.endDate}).`,
    onSuccess: close,
  })

  const submit = () => {
    if (!member || !planId) {
      setError('Choose a member and a plan.')
      return
    }
    setError(null)
    sell.mutate({ memberProfileId: member.id, membershipPlanId: Number(planId), startDate: orNull(startDate) }, { onError: (e) => setError(errorMessage(e)) })
  }

  const selectedPlan = plans.data?.find((p) => p.id === Number(planId))

  return (
    <Modal
      open={open}
      onClose={close}
      title="Sell membership"
      description="Leave the start date empty to start today, or the day after the member's current membership ends."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={sell.isPending}>
            Create membership
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sm-member" className="text-sm font-medium text-fg">
            Member
          </label>
          <EntityPicker name="member-picker" inputId="sm-member" search={searchMembers} value={member} onChange={setMember} disabled={Boolean(fixedMember)} placeholder="Search members…" />
        </div>
        <Field id="sm-plan" label="Plan">
          <Select id="sm-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Choose a plan</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.durationDays} days — {formatCurrency(p.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="sm-start" label="Start date (optional)" hint="Up to 30 days in the past is allowed.">
          <Input id="sm-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {selectedPlan && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
            Price <span className="font-semibold text-fg">{formatCurrency(selectedPlan.price)}</span>. Record the payment afterwards from Payments or the member's page.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Record a payment ----------

const METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]

export function RecordPaymentModal({ open, onClose, membership: fixedMembership }: { open: boolean; onClose: () => void; membership?: PickerOption & { balance: number } }) {
  const [membership, setMembership] = useState<PickerOption | null>(fixedMembership ?? null)
  const [amount, setAmount] = useState(fixedMembership ? String(fixedMembership.balance) : '')
  const [method, setMethod] = useState<PaymentMethod>('Upi')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setMembership(fixedMembership ?? null)
    setAmount(fixedMembership ? String(fixedMembership.balance) : '')
    setMethod('Upi')
    setReference('')
    setNotes('')
    setError(null)
    onClose()
  }

  const record = useApiMutation(paymentsApi.create, {
    invalidate: [['payments'], ['memberships'], ['member']],
    toastErrors: false,
    onSuccess: (p) => {
      toast.success(`${formatCurrency(p.amount)} recorded for ${p.memberName}.`)
      close()
    },
  })

  const submit = () => {
    const value = Number(amount)
    if (!membership) return setError('Choose a membership.')
    if (!(value > 0) || Math.round(value * 100) !== value * 100) return setError('Enter an amount above zero with at most 2 decimals.')
    setError(null)
    record.mutate(
      { membershipId: membership.id, amount: value, method, referenceNumber: orNull(reference), notes: orNull(notes) },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record payment"
      description="Payments are taken at the front desk; no card details are stored."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={record.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rp-membership" className="text-sm font-medium text-fg">
            Membership
          </label>
          <EntityPicker
            name="membership-balance-picker"
            inputId="rp-membership"
            search={searchMembershipsWithBalance}
            value={membership}
            onChange={setMembership}
            disabled={Boolean(fixedMembership)}
            placeholder="Search by member or plan…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rp-amount" label="Amount (₹)">
            <Input id="rp-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field id="rp-method" label="Method">
            <Select id="rp-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="rp-reference" label="Reference (optional)" hint="Receipt number or UPI transaction ID.">
          <Input id="rp-reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
        </Field>
        <Field id="rp-notes" label="Notes (optional)">
          <Input id="rp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}
