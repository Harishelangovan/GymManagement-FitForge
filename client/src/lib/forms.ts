import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toApiError } from '@/api/errors'

/**
 * Puts the API's field errors (camelCase keys, same as our form field names) onto the form.
 * Returns a general message to show above the form, or null when every error was attached to a field.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string | null {
  const apiError = toApiError(error)

  if (apiError.isValidation) {
    for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
      setError(field as Path<T>, { type: 'server', message: messages[0] })
    }
    return null
  }

  return apiError.message
}
