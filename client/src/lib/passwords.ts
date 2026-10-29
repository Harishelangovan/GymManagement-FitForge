/** A readable temporary password that meets every rule (upper, lower, digit, symbol, 12 chars). */
export function generateTemporaryPassword(): string {
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length]
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  return `${pick(upper)}${Array.from({ length: 6 }, () => pick(lower)).join('')}${pick('!@#$%&')}${Array.from({ length: 4 }, () => pick(digits)).join('')}`
}
