import { api } from './client'
import type { DayOfWeek, MembershipState, WorkoutExercise } from './dashboard'
import type { PagedResult } from './types'

// Typed access to every Phase 4/5 endpoint. Shapes mirror GymManagement.Application/DTOs.
// Query objects are passed straight through as query-string parameters; empty values are dropped.

export type Query = Record<string, string | number | boolean | undefined | null>

const clean = (query?: Query) =>
  Object.fromEntries(Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))

const get = <T>(url: string, query?: Query) => api.get<T>(url, { params: clean(query) }).then((r) => r.data)
const post = <T>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data)
const put = <T>(url: string, body: unknown) => api.put<T>(url, body).then((r) => r.data)
const patch = <T>(url: string, body: unknown) => api.patch<T>(url, body).then((r) => r.data)
const del = (url: string) => api.delete(url).then(() => undefined)

export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay'
export type PaymentMethod = 'Cash' | 'Card' | 'Upi' | 'BankTransfer'
export type BookingStatus = 'Booked' | 'Cancelled'
export type { DayOfWeek, MembershipState, WorkoutExercise }

// ---------- People ----------

export interface UserAccount {
  id: string
  email: string
  firstName: string
  lastName: string
  phoneNumber: string | null
  role: string
  isActive: boolean
  isLockedOut: boolean
  createdUtc: string
}

export interface MembershipSummary { id: number; planName: string; startDate: string; endDate: string; state: MembershipState; daysRemaining: number }

export interface MemberListItem {
  id: number
  userId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  isActive: boolean
  joinedOn: string
  assignedTrainerId: number | null
  assignedTrainerName: string | null
  currentMembership: MembershipSummary | null
}

export interface MemberDetail extends MemberListItem {
  dateOfBirth: string | null
  gender: Gender | null
  heightCm: number | null
  weightKg: number | null
  fitnessGoal: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

export interface MemberProfileInput {
  firstName: string
  lastName: string
  phoneNumber: string | null
  dateOfBirth: string | null
  gender: Gender | null
  heightCm: number | null
  weightKg: number | null
  fitnessGoal: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

export interface CreateMemberInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  temporaryPassword: string
  assignedTrainerId: number | null
}

export interface Trainer {
  id: number
  userId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  specialization: string
  bio: string | null
  yearsOfExperience: number
  isAcceptingMembers: boolean
  isActive: boolean
  assignedMemberCount: number
}

export interface TrainerInput {
  firstName: string
  lastName: string
  phoneNumber: string | null
  specialization: string
  bio: string | null
  yearsOfExperience: number
  isAcceptingMembers: boolean
}

export interface CreateTrainerInput extends Omit<TrainerInput, 'isAcceptingMembers'> {
  email: string
  temporaryPassword: string
}

// ---------- Billing ----------

export interface MembershipPlan { id: number; name: string; description: string | null; durationDays: number; price: number; isActive: boolean }
export type MembershipPlanInput = Omit<MembershipPlan, 'id'>

export interface Membership {
  id: number
  memberProfileId: number
  memberName: string
  memberEmail: string
  membershipPlanId: number
  planName: string
  startDate: string
  endDate: string
  priceAtPurchase: number
  amountPaid: number
  balance: number
  state: MembershipState
  daysRemaining: number
  createdUtc: string
}

export interface Payment {
  id: number
  membershipId: number
  memberProfileId: number
  memberName: string
  planName: string
  amount: number
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  paidUtc: string
  recordedByName: string
}

// ---------- Training ----------

export interface ExerciseInput {
  dayOfWeek: DayOfWeek
  name: string
  sets: number
  reps: number
  weightKg: number | null
  restSeconds: number
  notes: string | null
}

export interface WorkoutPlan {
  id: number
  memberProfileId: number
  memberName: string
  trainerProfileId: number
  trainerName: string
  title: string
  goal: string | null
  startDate: string
  endDate: string | null
  isActive: boolean
  createdUtc: string
  updatedUtc: string | null
  exercises: WorkoutExercise[]
}

export interface DietPlan {
  id: number
  memberProfileId: number
  memberName: string
  trainerProfileId: number
  trainerName: string
  title: string
  dailyCalories: number
  proteinGrams: number
  breakfast: string
  lunch: string
  dinner: string
  snacks: string | null
  notes: string | null
  isActive: boolean
  createdUtc: string
  updatedUtc: string | null
}

export interface DietPlanInput {
  title: string
  dailyCalories: number
  proteinGrams: number
  breakfast: string
  lunch: string
  dinner: string
  snacks: string | null
  notes: string | null
}

export interface FitnessClass {
  id: number
  title: string
  description: string | null
  trainerProfileId: number
  trainerName: string
  startUtc: string
  endUtc: string
  capacity: number
  bookedCount: number
  spotsLeft: number
  location: string
  isCancelled: boolean
  isBookedByMe: boolean
}

export interface ClassInput {
  title: string
  description: string | null
  startUtc: string
  endUtc: string
  capacity: number
  location: string
}

export interface Booking {
  id: number
  fitnessClassId: number
  classTitle: string
  classStartUtc: string
  classEndUtc: string
  location: string
  trainerName: string
  status: BookingStatus
  bookedUtc: string
  cancelledUtc: string | null
  isClassCancelled: boolean
}

export interface RosterEntry { bookingId: number; memberProfileId: number; memberName: string; memberEmail: string; bookedUtc: string; attended: boolean }

export interface AttendanceRecord {
  id: number
  memberProfileId: number
  memberName: string
  fitnessClassId: number | null
  classTitle: string | null
  checkInUtc: string
  markedByName: string
}

export interface AuditLogEntry {
  id: number
  createdUtc: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string
  details: string | null
  ipAddress: string | null
}

// ---------- Endpoints ----------

export const usersApi = {
  list: (q?: Query) => get<PagedResult<UserAccount>>('/users', q),
  setStatus: (id: string, isActive: boolean) => patch<UserAccount>(`/users/${id}/status`, { isActive }),
}

export const membersApi = {
  list: (q?: Query) => get<PagedResult<MemberListItem>>('/members', q),
  get: (id: number) => get<MemberDetail>(`/members/${id}`),
  mine: () => get<MemberDetail>('/members/me'),
  updateMine: (input: MemberProfileInput) => put<MemberDetail>('/members/me', input),
  create: (input: CreateMemberInput) => post<MemberDetail>('/members', input),
  update: (id: number, input: MemberProfileInput) => put<MemberDetail>(`/members/${id}`, input),
  assignTrainer: (id: number, trainerProfileId: number | null) => put<MemberDetail>(`/members/${id}/trainer`, { trainerProfileId }),
}

export const trainersApi = {
  list: (q?: Query) => get<PagedResult<Trainer>>('/trainers', q),
  get: (id: number) => get<Trainer>(`/trainers/${id}`),
  create: (input: CreateTrainerInput) => post<Trainer>('/trainers', input),
  update: (id: number, input: TrainerInput) => put<Trainer>(`/trainers/${id}`, input),
}

export const plansApi = {
  list: (includeInactive = false) => get<MembershipPlan[]>('/membership-plans', { includeInactive }),
  create: (input: MembershipPlanInput) => post<MembershipPlan>('/membership-plans', input),
  update: (id: number, input: MembershipPlanInput) => put<MembershipPlan>(`/membership-plans/${id}`, input),
}

export const membershipsApi = {
  list: (q?: Query) => get<PagedResult<Membership>>('/memberships', q),
  mine: () => get<Membership[]>('/memberships/my'),
  create: (input: { memberProfileId: number; membershipPlanId: number; startDate: string | null }) => post<Membership>('/memberships', input),
  cancel: (id: number) => post<Membership>(`/memberships/${id}/cancel`),
}

export const paymentsApi = {
  list: (q?: Query) => get<PagedResult<Payment>>('/payments', q),
  mine: (q?: Query) => get<PagedResult<Payment>>('/payments/my', q),
  create: (input: { membershipId: number; amount: number; method: PaymentMethod; referenceNumber: string | null; notes: string | null }) =>
    post<Payment>('/payments', input),
}

export const workoutsApi = {
  list: (q?: Query) => get<PagedResult<WorkoutPlan>>('/workout-plans', q),
  mine: () => get<WorkoutPlan[]>('/workout-plans/my'),
  create: (input: { memberProfileId: number; title: string; goal: string | null; startDate: string; endDate: string | null; exercises: ExerciseInput[] }) =>
    post<WorkoutPlan>('/workout-plans', input),
  update: (id: number, input: { title: string; goal: string | null; startDate: string; endDate: string | null; isActive: boolean; exercises: ExerciseInput[] }) =>
    put<WorkoutPlan>(`/workout-plans/${id}`, input),
}

export const dietsApi = {
  list: (q?: Query) => get<PagedResult<DietPlan>>('/diet-plans', q),
  mine: () => get<DietPlan[]>('/diet-plans/my'),
  create: (input: DietPlanInput & { memberProfileId: number }) => post<DietPlan>('/diet-plans', input),
  update: (id: number, input: DietPlanInput & { isActive: boolean }) => put<DietPlan>(`/diet-plans/${id}`, input),
}

export const classesApi = {
  list: (q?: Query) => get<PagedResult<FitnessClass>>('/classes', q),
  create: (input: ClassInput & { trainerProfileId: number | null }) => post<FitnessClass>('/classes', input),
  update: (id: number, input: ClassInput) => put<FitnessClass>(`/classes/${id}`, input),
  cancel: (id: number) => post<FitnessClass>(`/classes/${id}/cancel`),
  book: (id: number) => post<Booking>(`/classes/${id}/bookings`),
  cancelMyBooking: (id: number) => del(`/classes/${id}/bookings/me`),
  roster: (id: number) => get<RosterEntry[]>(`/classes/${id}/bookings`),
  myBookings: (q?: Query) => get<PagedResult<Booking>>('/bookings/my', q),
}

export const attendanceApi = {
  list: (q?: Query) => get<PagedResult<AttendanceRecord>>('/attendance', q),
  mine: (q?: Query) => get<PagedResult<AttendanceRecord>>('/attendance/my', q),
  mark: (memberProfileId: number, fitnessClassId: number | null) => post<AttendanceRecord>('/attendance', { memberProfileId, fitnessClassId }),
}

export const auditApi = {
  list: (q?: Query) => get<PagedResult<AuditLogEntry>>('/audit-logs', q),
}
