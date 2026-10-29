import { useEffect, useState } from 'react'

/**
 * The current time as a render-stable value that refreshes every `intervalMs`, so time-based UI
 * (can I still cancel? has attendance opened?) stays correct while a page stays open.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
