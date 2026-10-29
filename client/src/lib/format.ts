// The gym operates in India. The API sends UTC timestamps ("...Z") and plain dates ("yyyy-MM-dd");
// everything is shown in the gym's time zone so admins, trainers and members see the same times.
export const GYM_TIME_ZONE = 'Asia/Kolkata'
const LOCALE = 'en-IN'

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', timeZone: GYM_TIME_ZONE })
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: GYM_TIME_ZONE,
})
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: GYM_TIME_ZONE })

export const formatCurrency = (amount: number) => currency.format(amount)

/** "2026-10-29" (DateOnly) or an ISO timestamp → "29 Oct 2026". DateOnly values are not shifted by time zone. */
export function formatDate(value: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return dateFormat.format(new Date(isDateOnly ? `${value}T12:00:00+05:30` : value))
}

export const formatDateTime = (isoUtc: string) => dateTimeFormat.format(new Date(isoUtc))
export const formatTime = (isoUtc: string) => timeFormat.format(new Date(isoUtc))

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}
