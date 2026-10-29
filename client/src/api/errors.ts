import { AxiosError } from 'axios'
import type { ProblemDetails } from './types'

/** Every failed API call is turned into this, so UI code never has to inspect Axios internals. */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  /** Field errors keyed by camelCase property name, e.g. { email: ["..."] }. */
  readonly fieldErrors: Record<string, string[]>
  readonly retryAfterSeconds: number | null
  readonly traceId: string | null

  constructor(init: {
    status: number
    title: string
    message: string
    fieldErrors?: Record<string, string[]>
    retryAfterSeconds?: number | null
    traceId?: string | null
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.title = init.title
    this.fieldErrors = init.fieldErrors ?? {}
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
    this.traceId = init.traceId ?? null
  }

  get isValidation() {
    return this.status === 400 && Object.keys(this.fieldErrors).length > 0
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: "Can't reach the server. Check your connection and try again.",
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: 'We couldn’t find what you were looking for.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0
    const body = (error.response?.data ?? {}) as ProblemDetails
    const retryAfter = Number(error.response?.headers?.['retry-after'])

    return new ApiError({
      status,
      title: body.title ?? 'Request failed',
      message: body.detail ?? FALLBACK_MESSAGES[status] ?? FALLBACK_MESSAGES[500],
      fieldErrors: body.errors,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
      traceId: body.traceId ?? null,
    })
  }

  return new ApiError({ status: 0, title: 'Error', message: FALLBACK_MESSAGES[500] })
}

/** A short, user-facing message for toasts. */
export function errorMessage(error: unknown): string {
  return toApiError(error).message
}
