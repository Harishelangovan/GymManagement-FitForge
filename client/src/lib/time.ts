import { GYM_TIME_ZONE } from './format'

/** "Good morning / afternoon / evening" in gym-local time. */
export function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: GYM_TIME_ZONE }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/** e.g. "Thursday, 29 October", in gym-local time. */
export function todayLabel(): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: GYM_TIME_ZONE }).format(new Date())
}

/** Percentage change, or null when there is no previous value to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}
