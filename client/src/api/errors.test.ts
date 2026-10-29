import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, toApiError } from './errors'

function axiosFailure(status: number, data: unknown, headers: Record<string, string> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response = { status, statusText: '', data, headers, config } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response)
}

describe('toApiError', () => {
  it('maps a validation ProblemDetails to field errors', () => {
    const error = toApiError(
      axiosFailure(400, { title: 'One or more validation errors occurred.', status: 400, errors: { email: ['Enter a valid email address.'] }, traceId: 'abc' }),
    )

    expect(error.status).toBe(400)
    expect(error.isValidation).toBe(true)
    expect(error.fieldErrors).toEqual({ email: ['Enter a valid email address.'] })
    expect(error.traceId).toBe('abc')
  })

  it('prefers the server detail as the message', () => {
    expect(toApiError(axiosFailure(400, { detail: 'This class is full.' })).message).toBe('This class is full.')
  })

  it('falls back to a friendly message per status', () => {
    expect(toApiError(axiosFailure(403, {})).message).toBe("You don't have permission to do that.")
    expect(toApiError(axiosFailure(502, '')).message).toBe('Something went wrong on our side. Please try again.')
  })

  it('reads Retry-After on 429', () => {
    const error = toApiError(axiosFailure(429, { title: 'Too many requests' }, { 'retry-after': '42' }))
    expect(error.retryAfterSeconds).toBe(42)
    expect(error.isValidation).toBe(false)
  })

  it('treats a network failure (no response) as status 0', () => {
    const error = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Can't reach the server/)
  })

  it('passes ApiError through unchanged and wraps anything else', () => {
    const original = new ApiError({ status: 409, title: 'Conflict', message: 'Already booked.' })
    expect(toApiError(original)).toBe(original)
    expect(errorMessage(new TypeError('boom'))).toBe('Something went wrong on our side. Please try again.')
  })
})
