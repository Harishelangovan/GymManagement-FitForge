import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * List state (page, search, filters) kept in the URL: refreshing, sharing a link or pressing Back
 * restores exactly the same view. Changing any filter resets to page 1.
 */
export function useListParams<F extends Record<string, string>>(defaults: F) {
  const [params, setParams] = useSearchParams()

  const page = Math.max(1, Number(params.get('page')) || 1)
  // Cheap to recompute; React Query compares query keys by value, so a new object each render is fine.
  const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback])) as F

  const set = useCallback(
    (key: keyof F | 'page', value: string) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (value) next.set(String(key), value)
          else next.delete(String(key))
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const setPage = useCallback((value: number) => set('page', value > 1 ? String(value) : ''), [set])

  return { page, values, set, setPage }
}
