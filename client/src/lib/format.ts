// The gym operates in India. The API sends UTC timestamps ("...Z") and plain dates ("yyyy-MM-dd");
// everything is shown in the gym's time zone so admins, trainers and members see the same times.
export const GYM_TIME_ZONE = 'Asia/Kolkata'
const LOCALE = 'en-IN'

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const wholeCurrency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', timeZone: GYM_TIME_ZONE })
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: GYM_TIME_ZONE,
})
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: GYM_TIME_ZONE })

/** ₹9,500 for whole rupees, ₹299.50 when there are paise. */
export const formatCurrency = (amount: number) => (Number.isInteger(amount) ? wholeCurrency : currency).format(amount)

// Compact values for axis ticks and stat tiles: ₹13K, ₹1.3L (Indian lakh), 1.2K.
const compactCurrency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })
const compactNumber = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
export const formatCurrencyCompact = (amount: number) => compactCurrency.format(amount)
export const formatNumber = (value: number) => (Math.abs(value) >= 10_000 ? compactNumber.format(value) : value.toLocaleString(LOCALE))

/** "2026-10" → "Oct" (short) or "October 2026" (long). */
export function formatMonth(month: string, style: 'short' | 'long' = 'short'): string {
  const date = new Date(`${month}-15T12:00:00+05:30`)
  return new Intl.DateTimeFormat(LOCALE, style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' }).format(date)
}

/** "2026-10-29" → "Thu 29" (short) or "Thursday, 29 Oct" (long). */
export function formatDay(date: string, style: 'short' | 'long' = 'short'): string {
  const value = new Date(`${date}T12:00:00+05:30`)
  return new Intl.DateTimeFormat(
    LOCALE,
    style === 'short' ? { weekday: 'short', day: 'numeric', timeZone: GYM_TIME_ZONE } : { weekday: 'long', day: 'numeric', month: 'short', timeZone: GYM_TIME_ZONE },
  ).format(value)
}

const GYM_UTC_OFFSET = '+05:30' // Asia/Kolkata has no daylight saving time

/** "2026-10-30" + "07:00" (gym time) → UTC ISO string for the API. */
export function gymLocalToUtc(date: string, time: string): string {
  return new Date(`${date}T${time}:00${GYM_UTC_OFFSET}`).toISOString()
}

/** UTC ISO → { date: "2026-10-30", time: "07:00" } in gym time, for date/time inputs. */
export function utcToGymLocal(isoUtc: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoUtc))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

/** Today's gym-local date, yyyy-MM-dd. */
export const gymToday = () => gymDateOf(new Date().toISOString())

/** Adds days to a yyyy-MM-dd date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday of the week containing the given yyyy-MM-dd date. */
export function startOfWeek(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

/** The gym-local calendar date (yyyy-MM-dd) of a UTC timestamp. */
export function gymDateOf(isoUtc: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(new Date(isoUtc))
}

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
