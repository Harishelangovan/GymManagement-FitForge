import { CLIENT_HEADER, api } from './client'
import type { AuthResponse, CurrentUser } from './types'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  password: string
  confirmPassword: string
}

export interface ResetPasswordInput {
  email: string
  token: string
  newPassword: string
  confirmNewPassword: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export const authApi = {
  login: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input).then((r) => r.data),

  register: (input: RegisterInput) =>
    api.post<AuthResponse>('/auth/register', { ...input, phoneNumber: input.phoneNumber || null }).then((r) => r.data),

  logout: () => api.post('/auth/logout', null, { headers: CLIENT_HEADER }),

  me: () => api.get<CurrentUser>('/auth/me').then((r) => r.data),

  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),

  resetPassword: (input: ResetPasswordInput) => api.post('/auth/reset-password', input),

  changePassword: (input: ChangePasswordInput) => api.post('/auth/change-password', input),
}
