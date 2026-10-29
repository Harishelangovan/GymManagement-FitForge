// Shapes returned by the FitForge API (see GymManagement.Application/DTOs).

export type Role = 'Admin' | 'Trainer' | 'Member'

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  memberProfileId: number | null
  trainerProfileId: number | null
}

export interface AuthResponse {
  accessToken: string
  accessTokenExpiresUtc: string
  user: CurrentUser
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/** RFC 7807 body returned for every API error. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
  traceId?: string
}
