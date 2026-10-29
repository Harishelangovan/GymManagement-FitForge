import type { MembershipState, PaymentMethod } from '@/api/resources'
import type { Tone } from '@/components/ui/Feedback'

export const MEMBERSHIP_STATE_TONE: Record<MembershipState, Tone> = {
  Active: 'success',
  Upcoming: 'info',
  Expired: 'danger',
  Cancelled: 'neutral',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  Card: 'Card',
  Upi: 'UPI',
  BankTransfer: 'Bank transfer',
}

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** "" → null, for optional text inputs. */
export const orNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null)

/** "" → null, "72.5" → 72.5, for optional number inputs. */
export const numberOrNull = (value: string | number | null | undefined) => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
