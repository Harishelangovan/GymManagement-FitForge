import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'

interface Options<TResult> {
  /** Toast shown on success. */
  success?: string | ((result: TResult) => string)
  /** Query keys to refresh afterwards. Dashboards are always refreshed, since most changes affect them. */
  invalidate?: QueryKey[]
  /** Forms that show field errors themselves set this to false and catch the error from mutateAsync. */
  toastErrors?: boolean
  onSuccess?: (result: TResult) => void
}

/** useMutation with the app's conventions: refresh affected data, toast the outcome. */
export function useApiMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>, options: Options<TResult> = {}) {
  const queryClient = useQueryClient()
  const { success, invalidate = [], toastErrors = true, onSuccess } = options

  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await Promise.all([...invalidate, ['dashboard']].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      if (success) toast.success(typeof success === 'function' ? success(result) : success)
      onSuccess?.(result)
    },
    onError: (error) => {
      if (toastErrors) toast.error(errorMessage(error))
    },
  })
}
