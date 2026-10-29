import { describe, expect, it } from 'vitest'
import { niceTicks } from './chartScale'

describe('niceTicks', () => {
  it('uses round steps that cover the maximum', () => {
    expect(niceTicks(13_000)).toEqual([0, 5_000, 10_000, 15_000])
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
  })

  it('never produces fractional ticks for small counts', () => {
    expect(niceTicks(2)).toEqual([0, 1, 2])
    expect(niceTicks(1)).toEqual([0, 1])
  })

  it('handles an empty chart', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })

  it('always starts at zero, ends at or above the maximum and respects the tick budget', () => {
    for (const max of [3, 9, 11, 49, 51, 99, 101, 999, 1_234, 37_500, 1_00_000]) {
      const ticks = niceTicks(max)
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(max)
      expect(ticks.length - 1).toBeLessThanOrEqual(4)
      const step = ticks[1] - ticks[0]
      expect(ticks.every((t, i) => t === i * step)).toBe(true)
    }
  })
})
