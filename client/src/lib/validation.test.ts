import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword } from './passwords'
import { numberOrNull, orNull } from './status'
import { emailSchema, passwordSchema, phoneSchema } from './validation'

describe('passwordSchema (mirrors the API rules)', () => {
  it.each(['Str0ng!Pass', 'Aa1!aaaa'])('accepts %s', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(true)
  })

  it.each([
    ['too short', 'Aa1!aaa'],
    ['no uppercase', 'str0ng!pass'],
    ['no lowercase', 'STR0NG!PASS'],
    ['no number', 'Strong!Pass'],
    ['no symbol', 'Str0ngPass1'],
    ['too long', `Aa1!${'a'.repeat(125)}`],
  ])('rejects a password with %s', (_, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false)
  })
})

describe('generateTemporaryPassword', () => {
  it('always satisfies the password rules', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword()
      expect(password).toHaveLength(12)
      expect(passwordSchema.safeParse(password).success).toBe(true)
    }
  })
})

describe('emailSchema and phoneSchema', () => {
  it('trims and validates email', () => {
    expect(emailSchema.parse('  rahul@fitforge.test ')).toBe('rahul@fitforge.test')
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
    expect(emailSchema.safeParse('   ').error?.issues[0].message).toBe('Email is required.')
  })

  it('allows an empty phone (optional) and common formats', () => {
    for (const ok of ['', '+91 98765 43210', '98765-43210']) expect(phoneSchema.safeParse(ok).success).toBe(true)
    for (const bad of ['12345', 'call me', '+91 98765 43210 ext 5']) expect(phoneSchema.safeParse(bad).success).toBe(false)
  })
})

describe('optional input helpers', () => {
  it('turns blank text into null', () => {
    expect(orNull('  ')).toBeNull()
    expect(orNull(' Knee injury ')).toBe('Knee injury')
  })

  it('turns blank or invalid numbers into null', () => {
    expect(numberOrNull('')).toBeNull()
    expect(numberOrNull('abc')).toBeNull()
    expect(numberOrNull('72.5')).toBe(72.5)
    expect(numberOrNull(0)).toBe(0)
  })
})
