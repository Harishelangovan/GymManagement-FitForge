import { api } from './client'

// Mirrors GymManagement.Application/DTOs/Dashboard. Months are "yyyy-MM"; dates "yyyy-MM-dd" (gym-local);
// timestamps are UTC ISO strings.

export type MembershipState = 'Upcoming' | 'Active' | 'Expired' | 'Cancelled'
export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

export interface MonthlyAmount { month: string; amount: number }
export interface MonthlyCount { month: string; count: number }
export interface DailyAttendance { date: string; classVisits: number; gymCheckIns: number }

export interface AdminDashboard {
  kpis: {
    activeMembers: number
    totalMembers: number
    activeTrainers: number
    expiringSoon: number
    revenueThisMonth: number
    revenueLastMonth: number
    outstandingBalance: number
    checkInsToday: number
    classesToday: number
  }
  revenueByMonth: MonthlyAmount[]
  newMembersByMonth: MonthlyCount[]
  membershipBreakdown: { active: number; expiringSoon: number; lapsed: number; notStarted: number }
  attendanceByDay: DailyAttendance[]
  expiringMemberships: { membershipId: number; memberProfileId: number; memberName: string; planName: string; endDate: string; daysRemaining: number }[]
  recentPayments: { id: number; memberName: string; planName: string; amount: number; method: string; paidUtc: string }[]
  recentRegistrations: { memberProfileId: number; name: string; email: string; joinedOn: string; trainerName: string | null }[]
}

export interface Session { id: number; title: string; startUtc: string; endUtc: string; location: string; capacity: number; bookedCount: number }

export interface TrainerDashboard {
  kpis: { assignedMembers: number; sessionsToday: number; bookingsThisWeek: number; activeWorkoutPlans: number; membersWithoutWorkoutPlan: number }
  todaySessions: Session[]
  nextSevenDays: Session[]
  attendanceByDay: DailyAttendance[]
  recentActivity: { atUtc: string; memberProfileId: number; memberName: string; description: string }[]
  membersWithoutWorkoutPlan: { memberProfileId: number; memberName: string; fitnessGoal: string | null }[]
}

export interface WorkoutExercise {
  id: number
  dayOfWeek: DayOfWeek
  name: string
  sets: number
  reps: number
  weightKg: number | null
  restSeconds: number
  notes: string | null
  sortOrder: number
}

export interface MemberDashboard {
  firstName: string
  kpis: { visitsThisWeek: number; visitsLast30Days: number; upcomingClasses: number; classesAttended: number }
  membership: {
    id: number
    planName: string
    startDate: string
    endDate: string
    state: MembershipState
    daysRemaining: number
    totalDays: number
    balance: number
  } | null
  trainer: { id: number; name: string; specialization: string; email: string } | null
  todayWorkout: { planId: number; planTitle: string; day: DayOfWeek; exercises: WorkoutExercise[] } | null
  diet: { id: number; title: string; dailyCalories: number; proteinGrams: number } | null
  upcomingClasses: { classId: number; title: string; startUtc: string; endUtc: string; location: string; trainerName: string }[]
  visitsByWeek: { weekStart: string; visits: number }[]
  recentAttendance: { checkInUtc: string; classTitle: string | null }[]
}

export const dashboardApi = {
  admin: () => api.get<AdminDashboard>('/dashboard/admin').then((r) => r.data),
  trainer: () => api.get<TrainerDashboard>('/dashboard/trainer').then((r) => r.data),
  member: () => api.get<MemberDashboard>('/dashboard/member').then((r) => r.data),
}
