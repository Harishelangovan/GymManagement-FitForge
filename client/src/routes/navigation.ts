import {
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  Salad,
  ShieldCheck,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/api/types'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** The phase that builds this screen; until then the route shows a "coming soon" page. */
  phase: number
}

/** Sidebar items per role. The router also uses this list to register each page. */
export const NAVIGATION: Record<Role, NavItem[]> = {
  Admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, phase: 7 },
    { label: 'Members', path: '/admin/members', icon: Users, phase: 8 },
    { label: 'Trainers', path: '/admin/trainers', icon: Dumbbell, phase: 8 },
    { label: 'Plans', path: '/admin/plans', icon: Tags, phase: 8 },
    { label: 'Memberships', path: '/admin/memberships', icon: BadgeCheck, phase: 8 },
    { label: 'Payments', path: '/admin/payments', icon: Wallet, phase: 8 },
    { label: 'Classes', path: '/admin/classes', icon: CalendarDays, phase: 8 },
    { label: 'Attendance', path: '/admin/attendance', icon: ClipboardCheck, phase: 8 },
    { label: 'Audit log', path: '/admin/audit-logs', icon: ShieldCheck, phase: 8 },
  ],
  Trainer: [
    { label: 'Dashboard', path: '/trainer', icon: LayoutDashboard, phase: 7 },
    { label: 'My members', path: '/trainer/members', icon: Users, phase: 8 },
    { label: 'Workout plans', path: '/trainer/workouts', icon: Dumbbell, phase: 8 },
    { label: 'Diet plans', path: '/trainer/diets', icon: Salad, phase: 8 },
    { label: 'Classes', path: '/trainer/classes', icon: CalendarDays, phase: 8 },
    { label: 'Attendance', path: '/trainer/attendance', icon: ClipboardCheck, phase: 8 },
  ],
  Member: [
    { label: 'Dashboard', path: '/member', icon: LayoutDashboard, phase: 7 },
    { label: 'Membership', path: '/member/membership', icon: BadgeCheck, phase: 8 },
    { label: 'Workouts', path: '/member/workouts', icon: Dumbbell, phase: 8 },
    { label: 'Diet', path: '/member/diet', icon: Salad, phase: 8 },
    { label: 'Classes', path: '/member/classes', icon: CalendarDays, phase: 8 },
    { label: 'Attendance', path: '/member/attendance', icon: ClipboardCheck, phase: 8 },
    { label: 'Payments', path: '/member/payments', icon: Wallet, phase: 8 },
  ],
}
