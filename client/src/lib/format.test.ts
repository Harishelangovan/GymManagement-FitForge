import { describe, expect, it } from 'vitest'
import { addDays, formatCurrency, formatDate, formatMonth, gymDateOf, gymLocalToUtc, initials, startOfWeek, utcToGymLocal } from './format'

describe('test environment', () => {
  it('runs with a machine time zone far from the gym, so local-time bugs surface', () => {
    expect(new Date('2026-06-01T12:00:00Z').getTimezoneOffset()).toBe(240) // New York, UTC-4 in June
  })
})

describe('gym time conversions (Asia/Kolkata, UTC+05:30)', () => {
  it('turns gym-local date and time into UTC', () => {
    expect(gymLocalToUtc('2026-10-30', '07:00')).toBe('2026-10-30T01:30:00.000Z')
    expect(gymLocalToUtc('2026-10-30', '02:00')).toBe('2026-10-29T20:30:00.000Z') // previous UTC day
  })

  it('turns UTC back into gym-local date and time', () => {
    expect(utcToGymLocal('2026-10-29T20:30:00Z')).toEqual({ date: '2026-10-30', time: '02:00' })
    expect(utcToGymLocal('2026-10-30T13:15:00Z')).toEqual({ date: '2026-10-30', time: '18:45' })
  })

  it('round-trips without drift', () => {
    const { date, time } = utcToGymLocal(gymLocalToUtc('2026-12-31', '23:30'))
    expect({ date, time }).toEqual({ date: '2026-12-31', time: '23:30' })
  })

  it('gives the gym calendar date of a UTC timestamp, not the machine one', () => {
    expect(gymDateOf('2026-10-29T19:00:00Z')).toBe('2026-10-30') // 00:30 next day in India
    expect(gymDateOf('2026-10-29T18:29:00Z')).toBe('2026-10-29')
  })
})

describe('calendar helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29') // leap year
  })

  it('finds the Monday of a week (weeks start on Monday)', () => {
    expect(startOfWeek('2026-10-29')).toBe('2026-10-26') // Thursday
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26') // Monday itself
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26') // Sunday belongs to the previous week
  })
})

describe('display formatting', () => {
  it('shows whole rupees without paise and keeps paise when present', () => {
    expect(formatCurrency(9500)).toBe('₹9,500')
    expect(formatCurrency(150000)).toBe('₹1,50,000') // Indian digit grouping
    expect(formatCurrency(299.5)).toBe('₹299.50')
  })

  it('does not shift date-only values by time zone', () => {
    expect(formatDate('2026-10-29')).toBe('29 Oct 2026')
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026')
  })

  it('formats months', () => {
    expect(formatMonth('2026-10')).toBe('Oct')
    expect(formatMonth('2026-10', 'long')).toBe('October 2026')
  })

  it('builds initials', () => {
    expect(initials('rahul', 'kumar')).toBe('RK')
  })
})
