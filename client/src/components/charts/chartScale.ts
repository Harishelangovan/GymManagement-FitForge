/**
 * Round, evenly spaced y-axis ticks (0 / 5K / 10K / 15K, never 3.5K / 7K / 10.5K).
 * Step = 1, 2, 2.5 or 5 × 10ⁿ, chosen so there are at most `maxTicks` intervals.
 */
export function niceTicks(maxValue: number, maxTicks = 4): number[] {
  if (maxValue <= 0) return [0, 1]
  const rough = maxValue / maxTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude
  const wholeStep = Math.max(1, step) // counts are whole numbers
  const top = Math.ceil(maxValue / wholeStep) * wholeStep
  return Array.from({ length: Math.round(top / wholeStep) + 1 }, (_, i) => i * wholeStep)
}
