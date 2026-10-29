import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry only network/server errors; a 4xx won't fix itself (and 401 is already handled by the API client).
      retry: (failureCount, error) => failureCount < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
})
